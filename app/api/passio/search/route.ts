import { searchPassioCatalog, searchPassioTracks } from '@/lib/passio'

export const dynamic = 'force-dynamic'

/**
 * GET /api/passio/search?q=…&type=track|albums
 * - type=track (défaut) : recherche **directe de pistes** dans le catalogue
 *   Pass'io (index construit côté serveur, insensible aux accents).
 * - type=albums : recherche par album (titre / artiste).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const type = url.searchParams.get('type') ?? 'track'

  if (!q) return Response.json({ tracks: [], albums: [] })

  if (type === 'albums') {
    const albums = await searchPassioCatalog(q, 10)
    return Response.json({
      tracks: [],
      albums: albums.map((a) => ({
        id: a.id,
        title: a.title,
        artistName: a.artist_name,
        coverUrl: a.cover_url,
        type: a.type,
        publicationDate: a.publication_date,
      })),
    })
  }

  const tracks = await searchPassioTracks(q, 12)
  return Response.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      albumTitle: t.albumTitle,
      albumId: t.albumId,
      coverUrl: t.coverUrl,
      hasLyrics: t.hasLyrics,
    })),
    albums: [],
  })
}
