import { getPassioTrackLyrics } from '@/lib/passio'

export const dynamic = 'force-dynamic'

/**
 * GET /api/passio/lyrics/{trackId} — paroles LRC d'un titre Pass'io
 * (pré-remplissage du formulaire quand le catalogue les possède déjà).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params
  const lyrics = await getPassioTrackLyrics(trackId)
  if (lyrics === null) return Response.json({ error: 'Paroles indisponibles' }, { status: 404 })
  return Response.json({ lyrics })
}
