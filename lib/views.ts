/**
 * Vues des titres & classements — données du chart.
 *
 * - `song_views` : compteur par titre et par jour (Supabase), incrémenté via
 *   la route POST /api/song-views (côté serveur, clé admin, fonction SQL
 *   atomique `increment_song_view`).
 * - `getTopContributors` : le top des personnes qui ont contribué, classé par
 *   réputation (points = annotations mergées × 3 + votes reçus/émis).
 */
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/database.types'

/** Vues totales par titre (agrégat toutes dates). Map slug → vues. */
export async function getSongViews(): Promise<Map<string, number>> {
  const admin = getSupabaseAdmin()
  const map = new Map<string, number>()
  if (!admin) return map

  const { data } = await admin.from('song_views').select('song_id, count')
  for (const row of data ?? []) {
    map.set(row.song_id, (map.get(row.song_id) ?? 0) + (row.count ?? 0))
  }
  return map
}

/** Total de vues du catalogue (tous titres confondus). */
export async function getTotalViews(): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 0
  const { data } = await admin.from('song_views').select('count')
  return (data ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0)
}

/** Incrémente le compteur de vues d'un titre (serveur uniquement). */
export async function recordSongView(songId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  if (!admin) return false
  const { error } = await admin.rpc('increment_song_view', { p_song_id: songId })
  if (error) {
    console.error('[views] increment:', error.message)
    return false
  }
  return true
}

/** Un contributeur du classement. */
export interface TopContributor {
  id: string
  username: string
  displayName: string | null
  role: UserRole
  reputation: number
  mergedAnnotations: number
}

/**
 * Top des contributeurs : profils avec réputation > 0, classés par
 * réputation décroissante, avec leur nombre d'annotations publiées (merged).
 */
export async function getTopContributors(limit = 20): Promise<TopContributor[]> {
  const admin = getSupabaseAdmin()
  if (!admin) return []

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, display_name, role, reputation')
    .gt('reputation', 0)
    .order('reputation', { ascending: false })
    .limit(limit)
  if (!profiles || profiles.length === 0) return []

  // Annotations merged par auteur (comptage côté client, évite N+1).
  const { data: merged } = await admin.from('annotations').select('author_id').eq('status', 'merged')
  const mergedCount = new Map<string, number>()
  for (const a of merged ?? []) {
    mergedCount.set(a.author_id, (mergedCount.get(a.author_id) ?? 0) + 1)
  }

  return profiles.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    role: p.role,
    reputation: p.reputation,
    mergedAnnotations: mergedCount.get(p.id) ?? 0,
  }))
}

/** Nombre de contributeurs actifs (réputation > 0). */
export async function countContributors(): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 0
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gt('reputation', 0)
  return count ?? 0
}

/** Nombre d'annotations publiées (merged) dans le canon. */
export async function countMergedAnnotations(): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 0
  const { count } = await admin
    .from('annotations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'merged')
  return count ?? 0
}

// ── Votes par titre ────────────────────────────────────────────────────────

/** Top titres par votes reçus sur leurs annotations (score agrégé). */
export interface SongVoteStats {
  songId: string
  totalVotes: number  // somme des votes (±1) sur toutes les annotations du titre
  annotationCount: number
}

export async function getTopVotedSongs(limit = 10): Promise<SongVoteStats[]> {
  const admin = getSupabaseAdmin()
  if (!admin) return []

  // Récupérer toutes les annotations merged avec leur score de votes
  const { data: annotations } = await admin
    .from('annotations')
    .select('song_id, score')
    .eq('status', 'merged')

  if (!annotations || annotations.length === 0) return []

  // Agréger par song_id
  const bySong = new Map<string, { totalVotes: number; count: number }>()
  for (const a of annotations) {
    const prev = bySong.get(a.song_id) ?? { totalVotes: 0, count: 0 }
    bySong.set(a.song_id, {
      totalVotes: prev.totalVotes + (a.score ?? 0),
      count: prev.count + 1,
    })
  }

  return [...bySong.entries()]
    .map(([songId, stats]) => ({ songId, totalVotes: stats.totalVotes, annotationCount: stats.count }))
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, limit)
}

/** Total de votes émis dans le système. */
export async function countTotalVotes(): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 0
  const { count } = await admin
    .from('votes')
    .select('annotation_id', { count: 'exact', head: true })
  return count ?? 0
}
