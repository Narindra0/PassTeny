import { searchArtists, searchSongs } from '@/lib/search'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json({ results: [], artists: [] })
  const [results, artists] = await Promise.all([searchSongs(q), searchArtists(q)])
  return Response.json({ results, artists })
}
