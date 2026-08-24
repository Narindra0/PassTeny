'use client'

/**
 * Page titre côté client — fetch les lyrics + annotations depuis Supabase
 * dans le navigateur (0 CPU Worker).
 */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase/client'
import CoverImage from '@/components/CoverImage'
import SongContent from '@/components/SongContent'

interface Annotation {
  id: string
  start: number
  end: number
  quote: string
  body: string
  tags: string[]
  author: string
  score: number
  status: string
}

interface SongData {
  slug: string
  title: string
  artist: string
  album: string
  coverUrl?: string | null
  lyrics: string
  annotations: Annotation[]
  annotationCount: number
  language?: string[]
}

export default function SongPageClient({ slug }: { slug: string }) {
  const [song, setSong] = useState<SongData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); setError(true); return }

    async function fetchSong() {
      // 1. Métadonnées
      const { data: songData } = await supabase!
        .from('songs')
        .select('*')
        .eq('id', slug)
        .single()

      if (!songData) { setLoading(false); setError(true); return }

      // 2. Annotations
      const { data: annData } = await supabase!
        .from('annotations')
        .select('id, start_offset, end_offset, quote, body, tags, score, status, author_id, created_at')
        .eq('song_id', slug)

      // 3. Usernames
      const authorIds = [...new Set((annData ?? []).map((a: any) => a.author_id))]
      const { data: profiles } = authorIds.length
        ? await supabase!.from('profiles').select('id, username').in('id', authorIds)
        : { data: [] }
      const usernameById = new Map((profiles ?? []).map((p: any) => [p.id, p.username]))

      const annotations: Annotation[] = (annData ?? []).map((a: any) => ({
        id: a.id,
        start: a.start_offset,
        end: a.end_offset,
        quote: a.quote,
        body: a.body,
        tags: a.tags ?? [],
        author: usernameById.get(a.author_id) ?? 'inconnu',
        score: a.score ?? 0,
        status: a.status,
      }))

      setSong({
        slug: songData.id,
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-ink-faint" />
          <p className="mt-3 text-sm text-ink-soft">Chargement…</p>
        </div>
      </div>
    )
  }

  if (error || !song) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red" />
          <p className="mt-3 text-sm text-ink-soft">Titre introuvable.</p>
          <Link href="/" className="mt-4 btn btn-primary btn-sm">Retour à l'accueil</Link>
        </div>
      </div>
    )
  }

  const mergedAnnotations = song.annotations.filter((a) => a.status === 'merged')

  return (
    <div className="flex-1">
      {/* Hero */}
      <div className="song-hero">
        <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-5 sm:px-6 sm:pb-14">
          <nav className="font-mono text-[0.65rem] uppercase tracking-wider text-paper/50">
            <Link href="/" className="transition-colors hover:text-white">Accueil</Link>
            <span className="mx-2 text-paper/30">/</span>
            <span>{song.artist}</span>
          </nav>

          <div className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-9">
            <div className="h-44 w-44 shrink-0 rounded-[4px] bg-paper/10 sm:h-60 sm:w-60" />
            <div className="min-w-0">
              <h1 className="song-hero-title text-paper">{song.title}</h1>
              <p className="mt-2.5 text-[15px] font-medium text-paper/75">{song.artist}</p>
              {song.album && (
                <p className="mt-1.5 text-[13px] text-paper/60">{song.album}</p>
              )}
              <div className="mt-5 font-mono text-[11.5px] text-paper/55">
                <i className="fa-solid fa-pen-nib mr-1.5 text-red-light" />
                {song.annotationCount > 0
                  ? `${song.annotationCount} passage${song.annotationCount > 1 ? 's' : ''} annoté${song.annotationCount > 1 ? 's' : ''}`
                  : 'à annoter'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lyrics */}
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <p className="mb-6 border-b border-line pb-4 text-sm text-ink-soft">
          <i className="fa-solid fa-highlighter mr-1.5 text-mustard-dark" />
          Sélectionnez un passage pour l'annoter ou le proposer comme punchline.
        </p>
        <SongContent
          song={{
            slug: song.slug,
            title: song.title,
            artist: song.artist,
            album: song.album,
            coverUrl: song.coverUrl,
            lyrics: song.lyrics,
            lrc: undefined,
            annotations: mergedAnnotations.map((a) => ({
              ...a,
              startOffset: a.start,
              endOffset: a.end,
              createdAt: '',
            })),
            annotationCount: song.annotationCount,
            meta: { title: song.title, artist: song.artist, album: song.album, artists: [song.artist], language: song.language },
          } as any}
          canAnnotate={true}
        />
      </div>
    </div>
  )
}
