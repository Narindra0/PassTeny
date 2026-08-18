'use client'

/**
 * Wrapper client de la page titre : relie le rendu des lyrics (création
 * d'annotations) et la liste des soumissions en attente (votes) via une
 * clé de rafraîchissement partagée.
 */
import { useEffect, useState } from 'react'
import type { Song } from '@/lib/types'
import LyricsView from './LyricsView'
import PendingAnnotations from './PendingAnnotations'

export default function SongContent({
  song,
  canAnnotate,
}: {
  song: Song
  canAnnotate: boolean
}) {
  const [refreshKey, setRefreshKey] = useState(0)

  // Compte une vue par titre et par session (sessionStorage) — silencieux
  // en cas d'échec (le comptage ne doit jamais gêner la lecture).
  useEffect(() => {
    const count = () => {
      void fetch('/api/song-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: song.slug }),
      }).catch(() => {})
    }
    try {
      const key = `pass-teny:viewed:${song.slug}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage indisponible (navigation privée stricte) : on compte quand même.
    }
    count()
  }, [song.slug])

  return (
    <>
      <LyricsView
        lyrics={song.lyrics}
        annotations={song.annotations}
        songSlug={song.slug}
        songTitle={song.title}
        songArtist={song.artist}
        songCover={song.coverUrl}
        canAnnotate={canAnnotate}
        onAnnotationSubmitted={() => setRefreshKey((k) => k + 1)}
      />
      <div className="mt-12">
        <PendingAnnotations songSlug={song.slug} refreshKey={refreshKey} />
      </div>
    </>
  )
}
