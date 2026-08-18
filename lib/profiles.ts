/**
 * Gestion des profils Pass'Teny.
 *
 * Le profil est créé automatiquement à la première connexion (callback
 * d'auth) avec un username dérivé de l'email. La table `profiles` suit
 * `auth.users` (id identique) et porte la réputation + le rôle.
 *
 * Onboarding : au premier login, l'utilisateur confirme son pseudo et
 * peut renseigner ses liens Facebook / Instagram (optionnels). Tant que
 * `onboarding_done` est faux, il est redirigé vers /auth/onboarding.
 */
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { config } from '@/lib/config'
import type { SessionUser } from '@/lib/auth'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  github_handle: string | null
  facebook_url: string | null
  instagram_url: string | null
  onboarding_done: boolean
  role: 'contributor' | 'trusted' | 'moderator'
  reputation: number
}

/** Colonnes introduites par l'upgrade « onboarding » (schema.sql). */
const ONBOARDING_COLS = 'facebook_url, instagram_url, onboarding_done'
const PROFILE_COLS = `id, username, display_name, github_handle, ${ONBOARDING_COLS}, role, reputation`

/** Récupère un profil, en tolérant l'absence des colonnes d'onboarding
 * (projet Supabase pas encore migré) : on retombe sur le jeu de colonnes
 * historique plutôt que de casser le login. */
async function selectProfile(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, userId: string): Promise<Profile | null> {
  const full = await admin.from('profiles').select(PROFILE_COLS).eq('id', userId).maybeSingle()
  if (!full.error && full.data) return full.data as Profile
  if (!String(full.error?.message ?? '').toLowerCase().includes('does not exist')) {
    if (full.error) console.error('[profiles] select:', full.error.message)
    return null
  }
  const legacy = await admin
    .from('profiles')
    .select('id, username, display_name, github_handle, role, reputation')
    .eq('id', userId)
    .maybeSingle()
  if (legacy.error) {
    console.error('[profiles] select (legacy):', legacy.error.message)
    return null
  }
  const p = legacy.data as Profile & { facebook_url?: null; instagram_url?: null; onboarding_done?: boolean }
  return {
    ...p,
    facebook_url: p.facebook_url ?? null,
    instagram_url: p.instagram_url ?? null,
    // Pré-migration : on considère l'onboarding comme fait (pas de blocage).
    onboarding_done: p.onboarding_done ?? true,
  }
}

function deriveUsername(email: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_.-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 20)
  return base.length >= 3 ? base : `fan_${base || 'teny'}`
}

/**
 * Bootstrap des modérateurs (au login) :
 * 1. L'email est dans `MODERATOR_EMAILS` → rôle `moderator`.
 * 2. Sinon, si AUCUN modérateur n'existe encore et que l'utilisateur est le
 *    profil le plus ancien → promotion « fondateur » : il y a toujours
 *    quelqu'un pour approuver les premières contributions (ex. Jack).
 */
async function syncModeratorRole(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  user: SessionUser,
  profile: Profile,
): Promise<Profile> {
  if (profile.role === 'moderator') return profile

  let promote = config.moderatorEmails.includes(user.email.toLowerCase())

  if (!promote) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'moderator')
    if ((count ?? 0) === 0) {
      const { data: oldest } = await admin
        .from('profiles')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      promote = oldest?.id === profile.id
    }
  }

  if (!promote) return profile

  const { data: updated } = await admin
    .from('profiles')
    .update({ role: 'moderator' })
    .eq('id', profile.id)
    .select(PROFILE_COLS)
    .single()
  return (updated as Profile) ?? profile
}

/** Crée le profil s'il n'existe pas (idempotent). Retourne le profil. */
export async function ensureProfile(user: SessionUser): Promise<Profile | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const existing = await selectProfile(admin, user.id)
  if (existing) return syncModeratorRole(admin, user, existing)

  const base = deriveUsername(user.email)
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = attempt === 0 ? base : `${base}_${attempt + 1}`
    const { error } = await admin.from('profiles').insert({ id: user.id, username, display_name: null })

    if (!error) {
      const created = await selectProfile(admin, user.id)
      return created ? syncModeratorRole(admin, user, created) : null
    }
    if (!String(error.message).toLowerCase().includes('duplicate')) {
      console.error('[profiles] ensureProfile:', error.message)
      return null
    }
    // Conflit d'username : on réessaie avec un suffixe.
  }
  return null
}

/** Récupère le profil d'un utilisateur (ou null). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  return selectProfile(admin, userId)
}

/** Normalise et valide un lien de réseau social (facebook / instagram). */
function normalizeSocialUrl(raw: string, kind: 'facebook' | 'instagram'): string | null {
  const value = raw.trim()
  if (!value) return null

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const allowed = kind === 'facebook' ? ['facebook.com', 'fb.com'] : ['instagram.com']
  if (!allowed.includes(host)) return null

  return url.toString().replace(/\/$/, '')
}

export interface OnboardingInput {
  username: string
  facebook_url?: string | null
  instagram_url?: string | null
}

export type OnboardingResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string; field?: 'username' | 'facebook_url' | 'instagram_url' }

/**
 * Complète l'onboarding : pseudo choisi (unique) + liens optionnels.
 * Marque le profil comme onboardé. Retourne un résultat typé pour l'API.
 */
export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<OnboardingResult> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase n’est pas configuré' }

  const username = input.username?.trim() ?? ''
  if (username.length < 3 || username.length > 24) {
    return { ok: false, error: 'Le pseudo doit contenir entre 3 et 24 caractères.', field: 'username' }
  }
  if (!/^[a-z0-9_.-]+$/i.test(username)) {
    return { ok: false, error: 'Le pseudo ne peut contenir que des lettres, chiffres, points, tirets et underscores.', field: 'username' }
  }

  const facebook_url = normalizeSocialUrl(input.facebook_url ?? '', 'facebook')
  const instagram_url = normalizeSocialUrl(input.instagram_url ?? '', 'instagram')
  if (input.facebook_url?.trim() && !facebook_url) {
    return { ok: false, error: 'Lien Facebook invalide (attendu : facebook.com/…).', field: 'facebook_url' }
  }
  if (input.instagram_url?.trim() && !instagram_url) {
    return { ok: false, error: 'Lien Instagram invalide (attendu : instagram.com/…).', field: 'instagram_url' }
  }

  const { data, error } = await admin
    .from('profiles')
    .update({ username, facebook_url, instagram_url, onboarding_done: true })
    .eq('id', userId)
    .select(PROFILE_COLS)
    .single()

  if (error) {
    if (String(error.message).toLowerCase().includes('duplicate')) {
      return { ok: false, error: 'Ce pseudo est déjà pris.', field: 'username' }
    }
    console.error('[profiles] completeOnboarding:', error.message)
    return { ok: false, error: 'Impossible d’enregistrer le profil.' }
  }

  return { ok: true, profile: data as Profile }
}
