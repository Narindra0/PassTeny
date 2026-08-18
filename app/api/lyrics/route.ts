import { requireUser } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { slugifyContent } from '@/lib/github'
import { getDailyQuota, getUsedToday } from '@/lib/lyrics'
import { getLaunchMode, publishLyricSuggestion } from '@/lib/publish'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

const MAX_LYRICS_LENGTH = 50_000

/**
 * POST /api/lyrics — soumission d'un ajout de lyrics (nouveau titre).
 * Réservé aux utilisateurs connectés, limité à un quota par jour.
 * La proposition est enregistrée (statut `pending`) et, si le pipeline
 * GitHub est configuré, une PR est ouverte pour publier le titre.
 */
export async function POST(request: Request) {
  try {
    return await handlePost(request)
  } catch (err) {
    return routeError(err)
  }
}

async function handlePost(request: Request) {
  const user = await requireUser()
  const admin = getSupabaseAdmin()
  if (!admin) return Response.json({ error: 'Supabase n’est pas configuré' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const artistName = String(body.artistName ?? '').trim()
  const trackTitle = String(body.trackTitle ?? '').trim()
  const albumTitle = String(body.albumTitle ?? '').trim() || null
  const coverUrl = String(body.coverUrl ?? '').trim() || null
  const passioAlbumId = String(body.passioAlbumId ?? '').trim() || null
  const passioTrackId = String(body.passioTrackId ?? '').trim() || null
  const lyricsFormat = body.lyricsFormat
  const lyrics = String(body.lyrics ?? '')

  if (!artistName || artistName.length > 80) {
    return Response.json({ error: 'Nom d’artiste invalide' }, { status: 400 })
  }
  if (!trackTitle || trackTitle.length > 120) {
    return Response.json({ error: 'Titre de la chanson invalide' }, { status: 400 })
  }
  if (lyricsFormat !== 'lrc' && lyricsFormat !== 'txt') {
    return Response.json({ error: 'Format invalide (attendu : lrc ou txt)' }, { status: 400 })
  }
  const cleaned = lyrics.replace(/\r\n/g, '\n').trim()
  if (cleaned.length < 20) {
    return Response.json({ error: 'Les paroles sont trop courtes (20 caractères minimum)' }, { status: 400 })
  }
  if (cleaned.length > MAX_LYRICS_LENGTH) {
    return Response.json({ error: 'Les paroles sont trop longues' }, { status: 400 })
  }

  // ── Quota journalier ──
  const daily = await getDailyQuota()
  const usedToday = await getUsedToday(user.id)
  if (usedToday >= daily) {
    return Response.json(
      { error: `Quota journalier atteint (${daily} ajouts max par jour). Revenez demain !` },
      { status: 429 },
    )
  }

  // ── Insertion ──
  const artistSlug = slugifyContent(artistName) || 'artiste'
  const songSlug = slugifyContent(trackTitle) || 'titre'

  const { data: row, error: insertError } = await admin
    .from('lyric_suggestions')
    .insert({
      author_id: user.id,
      artist_name: artistName,
      artist_slug: artistSlug,
      track_title: trackTitle,
      song_slug: songSlug,
      album_title: albumTitle,
      cover_url: coverUrl,
      passio_track_id: passioTrackId,
      passio_album_id: passioAlbumId,
      lyrics_format: lyricsFormat,
      lyrics: cleaned,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !row) {
    // Anti-doublon : l'index unique (artist_slug, song_slug) a rejeté l'insert.
    if (String(insertError?.message ?? '').toLowerCase().includes('duplicate')) {
      return Response.json({ error: 'Ce titre a déjà été proposé.' }, { status: 409 })
    }
    console.error('[lyrics] insert:', insertError?.message)
    return Response.json({ error: 'Impossible d’enregistrer la proposition' }, { status: 500 })
  }

  // ── Publication : mode auto → commit direct ; mode manual → file de modération ──
  const mode = await getLaunchMode()
  if (mode === 'auto') {
    const publish = await publishLyricSuggestion({
      id: row.id,
      artistSlug,
      songSlug,
      artistName,
      title: trackTitle,
      album: albumTitle,
      coverUrl,
      passioAlbumId,
      passioTrackId,
      lyrics: cleaned,
      lyricsFormat,
    })
    if (!publish.ok) {
      return Response.json(
        { error: 'Proposition enregistrée, mais publication impossible — elle reste en attente.' },
        { status: 500 },
      )
    }
    return Response.json({
      ok: true,
      id: row.id,
      quotaLeft: Math.max(0, daily - usedToday - 1),
      published: true,
      commitUrl: publish.commitUrl,
    })
  }

  return Response.json({
    ok: true,
    id: row.id,
    quotaLeft: Math.max(0, daily - usedToday - 1),
    published: false,
  })
}
