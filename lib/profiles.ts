/**
 * Gestion des profils Pass'Teny.
 *
 * Le profil est créé automatiquement à la première connexion (callback
 * d'auth) avec un username dérivé de l'email. La table `profiles` suit
 * `auth.users` (id identique) et porte la réputation + le rôle.
 */
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { SessionUser } from '@/lib/auth'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  github_handle: string | null
  role: 'contributor' | 'trusted' | 'moderator'
  reputation: number
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

/** Crée le profil s'il n'existe pas (idempotent). Retourne le profil. */
export async function ensureProfile(user: SessionUser): Promise<Profile | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const { data: existing } = await admin
    .from('profiles')
    .select('id, username, display_name, github_handle, role, reputation')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) return existing as Profile

  const base = deriveUsername(user.email)
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = attempt === 0 ? base : `${base}_${attempt + 1}`
    const { data, error } = await admin
      .from('profiles')
      .insert({ id: user.id, username, display_name: null })
      .select('id, username, display_name, github_handle, role, reputation')
      .single()

    if (!error && data) return data as Profile
    if (error && !String(error.message).toLowerCase().includes('duplicate')) {
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
  const { data } = await admin
    .from('profiles')
    .select('id, username, display_name, github_handle, role, reputation')
    .eq('id', userId)
    .maybeSingle()
  return (data as Profile) ?? null
}
