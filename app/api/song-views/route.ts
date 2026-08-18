import { recordSongView } from '@/lib/views'

export const dynamic = 'force-dynamic'

/**
 * POST /api/song-views — compte une vue sur un titre (une fois par session
 * côté client). Incrément atomique en base via la clé admin ; aucune
 * authentification requise (comptage public).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const songId = typeof body.songId === 'string' ? body.songId.trim() : ''
    // Slug de titre : minuscules, chiffres, tirets.
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(songId)) {
      return Response.json({ error: 'songId invalide' }, { status: 400 })
    }
    await recordSongView(songId)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
