/**
 * Réputation & montée en grade (façon « IQ » Genius).
 *
 * Points (seuils paramétrables dans `settings` → `reputation`) :
 *   annotation      : points par annotation mergée
 *   vote_received   : points par vote reçu
 *   annotation_voted: points par vote émis
 *
 * Rôles (`settings` → `roles`) :
 *   trusted   : merged >= 5 et votes reçus >= 10
 *   moderator : merged >= 25 et âge >= 90 jours (cooptation manuelle)
 */
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { Profile } from '@/lib/profiles'

type SettingsMap = Record<string, unknown>

async function getSettings(): Promise<{ reputation: SettingsMap; roles: SettingsMap }> {
  const admin = getSupabaseAdmin()
  const defaults = {
    reputation: { annotation: 3, vote_received: 1, annotation_voted: 1 },
    roles: { trusted: { merged: 5, votes_received: 10 }, moderator: { merged: 25, age_days: 90 } },
  }
  if (!admin) return defaults

  const { data } = await admin.from('settings').select('key, value').in('key', ['reputation', 'roles'])
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, SettingsMap>
  return {
    reputation: { ...defaults.reputation, ...(map.reputation ?? {}) },
    roles: { ...defaults.roles, ...(map.roles ?? {}) },
  }
}

/** Compteurs de contribution d'un profil (merged + votes reçus/émis). */
export async function getContributionStats(userId: string) {
  const admin = getSupabaseAdmin()
  const empty = { merged: 0, votesReceived: 0, votesCast: 0, accountAgeDays: 0 }
  if (!admin) return empty

  const { count: merged } = await admin
    .from('annotations')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId)
    .eq('status', 'merged')

  // Votes reçus = votes portant sur les annotations de l'utilisateur.
  const { data: authored } = await admin
    .from('annotations')
    .select('id')
    .eq('author_id', userId)
  const authoredIds = (authored ?? []).map((a) => a.id)
  let votesReceived = 0
  if (authoredIds.length > 0) {
    const { count } = await admin
      .from('votes')
      .select('voter_id', { count: 'exact', head: true })
      .in('annotation_id', authoredIds)
    votesReceived = count ?? 0
  }

  const { count: votesCast } = await admin
    .from('votes')
    .select('voter_id', { count: 'exact', head: true })
    .eq('voter_id', userId)

  const { data: profile } = await admin.from('profiles').select('created_at').eq('id', userId).single()
  const accountAgeDays = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
    : 0

  return {
    merged: merged ?? 0,
    votesReceived,
    votesCast: votesCast ?? 0,
    accountAgeDays,
  }
}

/**
 * Recalcule la réputation d'un profil et applique la promotion éventuelle
 * (contributeur → contributeur de confiance).
 */
export async function recalcReputation(userId: string): Promise<Profile | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const settings = await getSettings()
  const stats = await getContributionStats(userId)
  const rep = settings.reputation as { annotation: number; vote_received: number; annotation_voted: number }
  const roles = settings.roles as { trusted: { merged: number; votes_received: number }; moderator: { merged: number; age_days: number } }

  const reputation =
    stats.merged * (rep.annotation ?? 0) + stats.votesReceived * (rep.vote_received ?? 0) + stats.votesCast * (rep.annotation_voted ?? 0)

  const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).single()
  if (!profile) return null

  let role = profile.role as Profile['role']
  if (
    role === 'contributor' &&
    stats.merged >= roles.trusted.merged &&
    stats.votesReceived >= roles.trusted.votes_received
  ) {
    role = 'trusted'
  }
  // modérateur : promotion manuelle (cooptation), pas d'auto-promotion.

  const { data: updated } = await admin
    .from('profiles')
    .update({ reputation, role })
    .eq('id', userId)
    .select('id, username, display_name, github_handle, role, reputation')
    .single()

  return (updated as Profile) ?? null
}
