'use client'

/**
 * Hooks React pour le fetch côté client depuis Supabase.
 * Remplace les Server Components qui fetchaient GitHub → Worker CPU > 10ms.
 * Maintenant : le navigateur fetch Supabase directement (0 CPU Worker).
 */
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type SongRow = Database['public']['Tables']['songs']['Row']
type AnnotationRow = Database['public']['Tables']['annotations']['Row']

/** Song résumé pour les listes (chart, accueil, etc.) */
export interface SongSummary {
  slug: string
  artistSlug: string
  title: string
  artist: string
  album: string
  coverUrl?: string | null
  annotationCount: number
  language?: string[]
}

/** Song complet avec lyrics + annotations */
export interface SongFull extends SongSummary {
  lyrics: string
  lrc?: string
  annotations: Annotation[]
}

export interface Annotation {
  id: string
  start: number
  end: number
  quote: string
  body: string
  tags: string[]
  author: string
  score: number
  status: string
  createdAt: string
}

/** Hook : tous les titres (pour chart, accueil, etc.) */
export function useSongs() {
  const [songs, setSongs] = useState<SongSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    supabase
      .from('songs')
      .select('id, artist_slug, artist_name, title, album, language')
      .order('title')
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return }

        // Compter les annotations par song via une requête séparée
        supabase
          .from('annotations')
          .select('song_id')
          .eq('status', 'merged')
          .then(({ data: annData }) => {
            const counts = new Map<string, number>()
            for (const a of annData ?? []) {
              counts.set(a.song_id, (counts.get(a.song_id) ?? 0) + 1)
            }

            setSongs(data.map((s) => ({
              slug: s.id,
              artistSlug: s.artist_slug,
              title: s.title,
              artist: s.artist_name,
              album: s.album ?? '',
              annotationCount: counts.get(s.id) ?? 0,
              language: s.language ?? undefined,
            })))
            setLoading(false)
          })
      })
  }, [])

  return { songs, loading }
}

/** Hook : un titre complet (lyrics + annotations) */
export function useSong(slug: string | null) {
  const [song, setSong] = useState<SongFull | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) { setLoading(false); return }
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    async function fetchSong() {
      // 1. Métadonnées du titre
      const { data: songData } = await supabase!
        .from('songs')
        .select('*')
        .eq('id', slug!)
        .single()

      if (!songData) { setLoading(false); return }

      // 2. Annotations merged (canon)
      const { data: annData } = await supabase!
        .from('annotations')
        .select('id, start_offset, end_offset, quote, body, tags, score, status, author_id, created_at')
        .eq('song_id', slug!)

      // 3. Résoudre les usernames
      const authorIds = [...new Set((annData ?? []).map((a) => a.author_id))]
      const { data: profiles } = authorIds.length
        ? await supabase!.from('profiles').select('id, username').in('id', authorIds)
        : { data: [] }
      const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]))

      const annotations: Annotation[] = (annData ?? []).map((a) => ({
        id: a.id,
        start: a.start_offset,
        end: a.end_offset,
        quote: a.quote,
        body: a.body,
        tags: a.tags ?? [],
        author: usernameById.get(a.author_id) ?? 'inconnu',
        score: a.score ?? 0,
        status: a.status,
        createdAt: a.created_at,
      }))

      setSong({
        slug: songData.id,
        artistSlug: songData.artist_slug,
        title: songData.title,
        artist: songData.artist_name,
        album: songData.album ?? '',
        coverUrl: null,
        lyrics: songData.lyrics_txt ?? '',
        annotations,
        annotationCount: annotations.filter((a) => a.status === 'merged').length,
        language: songData.language ?? undefined,
      })
      setLoading(false)
    }

    fetchSong()
  }, [slug])

  return { song, loading }
}

/** Hook : les vues par titre */
export function useSongViews() {
  const [views, setViews] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    supabase
      .from('song_views')
      .select('song_id, count')
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return }
        const map = new Map<string, number>()
        for (const row of data) {
          map.set(row.song_id, (map.get(row.song_id) ?? 0) + (row.count ?? 0))
        }
        setViews(map)
        setLoading(false)
      })
  }, [])

  return { views, loading }
}

/** Hook : top contributeurs */
export function useTopContributors(limit = 20) {
  const [contributors, setContributors] = useState<{ username: string; role: string; reputation: number; mergedAnnotations: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    supabase
      .from('profiles')
      .select('username, role, reputation')
      .gt('reputation', 0)
      .order('reputation', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return }

        // Compter les annotations merged par auteur
        supabase
          .from('annotations')
          .select('author_id')
          .eq('status', 'merged')
          .then(({ data: annData }) => {
            const counts = new Map<string, number>()
            for (const a of annData ?? []) {
              counts.set(a.author_id, (counts.get(a.author_id) ?? 0) + 1)
            }

            // On a besoin des IDs pour compter — on refait avec les profiles
            supabase!
              .from('profiles')
              .select('id, username, role, reputation')
              .gt('reputation', 0)
              .order('reputation', { ascending: false })
              .limit(limit)
              .then(({ data: fullData }) => {
                setContributors((fullData ?? []).map((p) => ({
                  username: p.username,
                  role: p.role,
                  reputation: p.reputation,
                  mergedAnnotations: counts.get(p.id) ?? 0,
                })))
                setLoading(false)
              })
          })
      })
  }, [limit])

  return { contributors, loading }
}

/** Hook : punchlines top */
export function useTopPunchlines(limit = 10) {
  const [punchlines, setPunchlines] = useState<{ id: string; songId: string; quote: string; score: number; author: string; songTitle: string; artistName: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    supabase
      .from('punchlines')
      .select('id, song_id, quote, score, author_id, status')
      .in('status', ['approved', 'pending'])
      .order('score', { ascending: false })
      .limit(limit)
      .then(async ({ data, error }) => {
        if (error || !data || data.length === 0) { setLoading(false); return }

        // Résoudre les auteurs et les titres
        const authorIds = [...new Set(data.map((p) => p.author_id))]
        const songIds = [...new Set(data.map((p) => p.song_id))]

        const [profilesRes, songsRes] = await Promise.all([
          supabase!.from('profiles').select('id, username').in('id', authorIds),
          supabase!.from('songs').select('id, title, artist_name').in('id', songIds),
        ])

        const usernameById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.username]))
        const songById = new Map((songsRes.data ?? []).map((s) => [s.id, { title: s.title, artist: s.artist_name }]))

        setPunchlines(data.map((p) => ({
          id: p.id,
          songId: p.song_id,
          quote: p.quote,
          score: p.score ?? 0,
          author: usernameById.get(p.author_id) ?? 'inconnu',
          songTitle: songById.get(p.song_id)?.title ?? '',
          artistName: songById.get(p.song_id)?.artist ?? '',
        })))
        setLoading(false)
      })
  }, [limit])

  return { punchlines, loading }
}
