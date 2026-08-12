/**
 * Recherche full-text sur l'index `songs`.
 *
 * V1 : recherche `ILIKE` multi-champs (titre, artiste, paroles) via
 * PostgREST — fonctionne sans migration. L'index `search` (tsvector) de la
 * table est prêt pour l'upgrade RPC `search_songs` (voir schema.sql) qui
 * apportera le classement par pertinence (ts_rank) et la recherche de mots
 * entiers.
 */
import { getSupabaseServer } from '@/lib/supabase/server'

export interface SearchResult {
  slug: string
  artistSlug: string
  artist: string
  title: string
  album: string | null
}

export async function searchSongs(query: string, limit = 20): Promise<SearchResult[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []

  const q = query.trim()
  if (!q) return []

  // Assainit l'entrée : on garde lettres/chiffres/espaces (accents inclus),
  // ce qui protège la grammaire or() de PostgREST (`,` `(` `)` `|` …)
  // et neutralise les wildcards ILIKE.
  const safe = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!safe) return []

  const { data, error } = await supabase
    .from('songs')
    .select('id, artist_slug, artist_name, title, album')
    .or(`title.ilike.%${safe}%,artist_name.ilike.%${safe}%,lyrics_txt.ilike.%${safe}%`)
    .order('artist_name')
    .limit(limit)

  if (error) {
    console.error('[search]', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    slug: row.id,
    artistSlug: row.artist_slug,
    artist: row.artist_name,
    title: row.title,
    album: row.album,
  }))
}
