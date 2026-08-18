import { getPassioAlbum } from '@/lib/passio'

export const dynamic = 'force-dynamic'

/**
 * GET /api/passio/albums/{id} — détail d'un album Pass'io avec sa tracklist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const album = await getPassioAlbum(id)
  if (!album) return Response.json({ error: 'Album introuvable' }, { status: 404 })

  return Response.json({
    id: album.id,
    title: album.title,
    artistName: album.artist_name,
    coverUrl: album.cover_url,
    type: album.type,
    publicationDate: album.publication_date,
    tracks: (album.tracks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      position: t.position,
      hasLyrics: t.has_lyrics,
    })),
  })
}
