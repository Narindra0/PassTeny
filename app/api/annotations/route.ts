import { getSong } from '@/lib/content/source'
import { validateAnnotation } from '@/lib/content/annotations'
import { requireUser } from '@/lib/auth'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profiles'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

/**
 * POST /api/annotations — soumet une annotation (statut `pending`).
 * Validation serveur : offsets dans les bornes du lyrics canon, citation
 * exacte, explication minimale. La chanson est indexée dans `songs`
 * (service-role) pour la recherche et le pipeline PR.
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

  const body = await request.json().catch(() => ({}))
  const { song_id, start_offset, end_offset, quote, body: text, tags } = body ?? {}

  if (typeof song_id !== 'string' || !song_id) {
    return Response.json({ error: 'Chanson manquante' }, { status: 400 })
  }
  if (typeof text !== 'string' || text.trim().length < 4) {
    return Response.json({ error: 'Explication trop courte (4 caractères minimum)' }, { status: 400 })
  }

  const song = await getSong(song_id)
  if (!song) return Response.json({ error: 'Chanson introuvable' }, { status: 404 })

  const start = Number(start_offset)
  const end = Number(end_offset)
  const validation = validateAnnotation(
    { start, end, quote: typeof quote === 'string' ? quote : '', body: text },
    song.lyrics,
  )
  if (!validation.ok) {
    return Response.json({ error: `Annotation invalide : ${validation.reasons.join(', ')}` }, { status: 400 })
  }

  const supabase = await createClient()
  if (!supabase || !admin) {
    return Response.json({ error: 'Supabase n’est pas configuré' }, { status: 500 })
  }

  // Indexe la chanson (recherche + chemin PR). Idempotent.
  await admin.from('songs').upsert(
    {
      id: song.slug,
      artist_slug: song.artistSlug,
      artist_name: song.artist,
      title: song.title,
      album: song.album,
      language: song.meta.language ?? [],
      lyrics_txt: song.lyrics,
    },
    { onConflict: 'id' },
  )

  const { data: annotation, error: insertError } = await supabase
    .from('annotations')
    .insert({
      song_id: song.slug,
      start_offset: start,
      end_offset: end,
      quote: song.lyrics.slice(start, end),
      body: text.trim(),
      tags: Array.isArray(tags) ? tags.map(String).slice(0, 5) : [],
      author_id: user.id,
      status: 'pending',
    })
    .select('id, song_id, start_offset, end_offset, quote, body, tags, status, score, created_at')
    .single()

  if (insertError) {
    console.error('[annotations] insert:', insertError.message)
    return Response.json({ error: 'Impossible d’enregistrer l’annotation' }, { status: 500 })
  }

  // Historique des révisions (v1).
  await supabase
    .from('annotation_versions')
    .insert({ annotation_id: annotation.id, body: text.trim(), author_id: user.id })
    .then(() => {})

  return Response.json({ ok: true, annotation }, { status: 201 })
}

/**
 * GET /api/annotations?song_id=…&status=pending — liste les soumissions.
 * Ajoute `canVote` selon le rôle du visiteur (contributeur de confiance+).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const songId = url.searchParams.get('song_id')
  const status = url.searchParams.get('status')

  const supabase = await createClient()
  if (!supabase) return Response.json({ error: 'Supabase non configuré' }, { status: 500 })

  let query = supabase
    .from('annotations')
    .select('id, song_id, start_offset, end_offset, quote, body, tags, status, score, pr_number, created_at, author_id')
    .order('created_at', { ascending: false })
    .limit(50)

  if (songId) query = query.eq('song_id', songId)
  if (status === 'pending' || status === 'approved' || status === 'merged' || status === 'rejected') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    console.error('[annotations] list:', error.message)
    return Response.json({ error: 'Erreur de lecture' }, { status: 500 })
  }

  // Usernames des auteurs (requête séparée — typage simple).
  const authorIds = [...new Set((data ?? []).map((a) => a.author_id))]
  const { data: profiles } = authorIds.length
    ? await supabase.from('profiles').select('id, username').in('id', authorIds)
    : { data: [] }
  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]))

  // Rôle du visiteur (vote réservé aux contributeurs de confiance+).
  const { data: { user } } = await supabase.auth.getUser()
  let canVote = false
  let viewerRole: string | null = null
  if (user) {
    const profile = await getProfile(user.id)
    viewerRole = profile?.role ?? null
    canVote = profile?.role === 'trusted' || profile?.role === 'moderator'
  }

  return Response.json({
    canVote,
    viewerRole,
    annotations: (data ?? []).map((a) => ({
      ...a,
      author: usernameById.get(a.author_id) ?? 'inconnu',
    })),
  })
}
