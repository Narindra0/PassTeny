/**
 * Suggestions de lyrics — quota journalier + suivi des propositions.
 */
import { getSupabaseAdmin } from '@/lib/supabase/server'

export interface LyricSuggestion {
  id: string
  artist_name: string
  track_title: string
  album_title: string | null
  lyrics_format: 'lrc' | 'txt'
  status: string
  pr_number: number | null
  created_at: string
}

/** Quota journalier (réglage `lyrics_quota`, défaut 5). */
export async function getDailyQuota(): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 5
  const { data } = await admin.from('settings').select('value').eq('key', 'lyrics_quota').maybeSingle()
  const value = data?.value as { daily?: number } | null | undefined
  const daily = Number(value?.daily)
  return Number.isFinite(daily) && daily > 0 ? Math.floor(daily) : 5
}

/** Nombre de suggestions déposées aujourd'hui par un utilisateur. */
export async function getUsedToday(userId: string): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 0
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count } = await admin
    .from('lyric_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId)
    .gte('created_at', todayStart.toISOString())
  return count ?? 0
}

/** Les dernières propositions d'un utilisateur (page « Ajouter une parole »). */
export async function getRecentSuggestions(userId: string, limit = 6): Promise<LyricSuggestion[]> {
  const admin = getSupabaseAdmin()
  if (!admin) return []
  const { data } = await admin
    .from('lyric_suggestions')
    .select(
      'id, artist_name, track_title, album_title, lyrics_format, status, pr_number, created_at',
    )
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as LyricSuggestion[]
}
