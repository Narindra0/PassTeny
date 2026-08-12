'use client'

/**
 * Wrapper client de la page titre : relie le rendu des lyrics (création
 * d'annotations) et la liste des soumissions en attente (votes) via une
 * clé de rafraîchissement partagée.
 */
import { useState } from 'react'
import type { Song } from '@/lib/types'
import LyricsView from './LyricsView'
import PendingAnnotations from './PendingAnnotations'

export default function SongContent({ song }: { song: Song }) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <LyricsView
        lyrics={song.lyrics}
        annotations={song.annotations}
        songSlug={song.slug}
        onAnnotationSubmitted={() => setRefreshKey((k) => k + 1)}
      />
      <div className="mt-12">
        <PendingAnnotations songSlug={song.slug} refreshKey={refreshKey} />
      </div>
    </>
  )
}
