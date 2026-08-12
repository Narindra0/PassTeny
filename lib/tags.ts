/**
 * Tags thématiques des annotations (amour, société, politique, spiritualité…).
 */
import { getSupabaseServer } from '@/lib/supabase/server'

export interface TagSummary {
  tag: string
  count: number
}

export interface TaggedAnnotation {
  id: string
  song_id: string
  quote: string
  body: string
  tags: string[]
  status: string
  score: number
  created_at: string
  author: string
}

/** Tags distincts avec leur nombre d'annotations (publiques). */
export async function listTags(): Promise<TagSummary[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('annotations')
    .select('tags')
    .in('status', ['pending', 'approved', 'merged'])
    .limit(1000)

  if (error) {
    console.error('[tags] list:', error.message)
    return []
  }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Annotations portant un tag donné (avec l'auteur). */
export async function listAnnotationsByTag(tag: string): Promise<TaggedAnnotation[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('annotations')
    .select('id, song_id, quote, body, tags, status, score, created_at, author_id')
    .contains('tags', [tag])
    .in('status', ['pending', 'approved', 'merged'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[tags] by tag:', error.message)
    return []
  }

  // Usernames des auteurs.
  const authorIds = [...new Set((data ?? []).map((a) => a.author_id))]
  const { data: profiles } = authorIds.length
    ? await supabase.from('profiles').select('id, username').in('id', authorIds)
    : { data: [] }
  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]))

  return (data ?? []).map((a) => ({
    id: a.id,
    song_id: a.song_id,
    quote: a.quote,
    body: a.body,
    tags: a.tags,
    status: a.status,
    score: a.score,
    created_at: a.created_at,
    author: usernameById.get(a.author_id) ?? 'inconnu',
  }))
}
