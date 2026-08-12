import { searchSongs } from '@/lib/search'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json({ results: [] })
  const results = await searchSongs(q)
  return Response.json({ results })
}
