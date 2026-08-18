/**
 * Modération des suggestions de lyrics.
 *
 * Le rôle `moderator` est réservé (bootstrap : MODERATOR_EMAILS ou fondateur
 * s'il n'y a aucun modérateur — voir lib/profiles.ts). L'approbation est le
 * moment du push : elle ouvre la PR sur le repo content (ou marque `approved`
 * si la PR existe déjà), puis le merge sur GitHub passe la suggestion à
 * `merged` via le webhook.
 */
import { requireUser } from '@/lib/auth'
import { getProfile } from '@/lib/profiles'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { publishLyricSuggestion } from '@/lib/publish'
import { publishAnnotations } from '@/lib/prService'
import type { Annotation } from '@/lib/types'

export interface SuggestionRow {
  id: string
  author_id: string
  artist_name: string
  artist_slug: string
  track_title: string
  song_slug: string
  album_title: string | null
  cover_url: string | null
  passio_track_id: string | null
  passio_album_id: string | null
  lyrics_format: 'lrc' | 'txt'
  lyrics: string
  status: string
  pr_number: number | null
  created_at: string
}

/** Exige un utilisateur modérateur (403 sinon). Retourne son profil. */
export async function requireModerator() {
  const user = await requireUser()
  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'moderator') {
    const err = new Error('Réservé aux modérateurs') as Error & { status?: number }
    err.status = 403
    throw err
  }
  return profile
}

/** File des suggestions (pending d'abord, puis récentes). */
export async function listSuggestionQueue(limit = 50): Promise<SuggestionRow[]> {
  const admin = getSupabaseAdmin()
  if (!admin) return []
  const { data } = await admin
    .from('lyric_suggestions')
    .select('*')
    .order('status', { ascending: false }) // 'pending' > 'approved' > 'rejected'
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as SuggestionRow[]
}

export type ModerationResult =
  | { ok: true; prNumber: number | null; prUrl: string | null; merged?: boolean }
  | { ok: false; error: string; status: number }

/**
 * Approuve une suggestion (mode manuel) : publie directement sur le repo
 * content (commit) et passe à `merged`. Approbation = publication.
 */
export async function approveSuggestion(id: string): Promise<ModerationResult> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré', status: 500 }

  const { data: suggestion } = await admin
    .from('lyric_suggestions')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .maybeSingle()
  if (!suggestion) {
    return { ok: false, error: 'Suggestion introuvable ou déjà traitée', status: 404 }
  }
  const s = suggestion as SuggestionRow

  const publish = await publishLyricSuggestion({
    id: s.id,
    artistSlug: s.artist_slug,
    songSlug: s.song_slug,
    artistName: s.artist_name,
    title: s.track_title,
    album: s.album_title,
    coverUrl: s.cover_url,
    passioAlbumId: s.passio_album_id,
    passioTrackId: s.passio_track_id,
    lyrics: s.lyrics,
    lyricsFormat: s.lyrics_format,
  })
  if (!publish.ok) {
    return { ok: false, error: publish.error ?? 'Publication impossible', status: 500 }
  }

  return { ok: true, prNumber: null, prUrl: publish.commitUrl }
}

/** Refuse une suggestion. */
export async function rejectSuggestion(id: string): Promise<ModerationResult> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré', status: 500 }

  const { data, error } = await admin
    .from('lyric_suggestions')
    .update({ status: 'rejected' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[moderation] reject:', error.message)
    return { ok: false, error: 'Impossible de mettre à jour la suggestion', status: 500 }
  }
  if (!data) return { ok: false, error: 'Suggestion introuvable ou déjà traitée', status: 404 }
  return { ok: true, prNumber: null, prUrl: null }
}

/* ════════════════════════════════════════════════════════════════════════
   Modération des ANNOTATIONS (soumissions de la communauté)
   ════════════════════════════════════════════════════════════════════════ */

/** Une soumission d'annotation prête pour la file de modération. */
export interface AnnotationQueueRow {
  id: string
  song_id: string
  song_title: string
  artist_name: string
  album: string | null
  quote: string
  body: string
  tags: string[]
  status: string
  score: number
  pr_number: number | null
  created_at: string
  author: string
}

/** File des soumissions d'annotations (les plus récentes d'abord). */
export async function listAnnotationQueue(limit = 50): Promise<AnnotationQueueRow[]> {
  const admin = getSupabaseAdmin()
  if (!admin) return []

  const { data } = await admin
    .from('annotations')
    .select('id, song_id, start_offset, end_offset, quote, body, tags, status, score, pr_number, created_at, author_id')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data || data.length === 0) return []

  // Jointures manuelles : chansons (titre/artiste) + profils (pseudo).
  const songIds = [...new Set(data.map((a) => a.song_id))]
  const authorIds = [...new Set(data.map((a) => a.author_id))]
  const [songsRes, profilesRes] = await Promise.all([
    songIds.length
      ? admin.from('songs').select('id, title, artist_name, album').in('id', songIds)
      : Promise.resolve({ data: [] }),
    authorIds.length
      ? admin.from('profiles').select('id, username').in('id', authorIds)
      : Promise.resolve({ data: [] }),
  ])
  const songById = new Map((songsRes.data ?? []).map((s) => [s.id, s]))
  const usernameById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.username]))

  return data.map((a) => ({
    id: a.id,
    song_id: a.song_id,
    song_title: songById.get(a.song_id)?.title ?? a.song_id,
    artist_name: songById.get(a.song_id)?.artist_name ?? '',
    album: songById.get(a.song_id)?.album ?? null,
    quote: a.quote,
    body: a.body,
    tags: a.tags ?? [],
    status: a.status,
    score: a.score,
    pr_number: a.pr_number,
    created_at: a.created_at,
    author: usernameById.get(a.author_id) ?? 'inconnu',
  }))
}

/** Nombre de soumissions en attente pour un titre (badge sur la page titre). */
export async function countPendingAnnotations(songId: string): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 0
  const { count } = await admin
    .from('annotations')
    .select('id', { count: 'exact', head: true })
    .eq('song_id', songId)
    .eq('status', 'pending')
  return count ?? 0
}

/**
 * Approuve une annotation : ouvre la PR sur le repo content et la fusionne
 * immédiatement (forceMerge) — l'annotation passe directement à `merged` et
 * paraît dans les lyrics, sans attente de merge manuel. Réservé aux
 * modérateurs.
 */
export async function approveAnnotation(id: string): Promise<ModerationResult> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré', status: 500 }

  const { data: row } = await admin
    .from('annotations')
    .select('id, song_id, start_offset, end_offset, quote, body, tags, author_id')
    .eq('id', id)
    .eq('status', 'pending')
    .maybeSingle()
  if (!row) return { ok: false, error: 'Annotation introuvable ou déjà traitée', status: 404 }

  const { data: song } = await admin
    .from('songs')
    .select('id, artist_slug')
    .eq('id', row.song_id)
    .maybeSingle()
  if (!song) return { ok: false, error: 'Chanson introuvable dans l’index', status: 404 }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username')
    .eq('id', row.author_id)
    .maybeSingle()

  const annotation: Annotation = {
    id: row.id,
    start: row.start_offset,
    end: row.end_offset,
    quote: row.quote,
    body: row.body,
    tags: row.tags ?? [],
    author: profile?.username ?? 'inconnu',
    authorId: row.author_id,
  }

  const publish = await publishAnnotations({
    songId: row.song_id,
    artistSlug: song.artist_slug,
    annotationIds: [row.id],
    annotations: [annotation],
    forceMerge: true, // l'approbation d'un modérateur publie immédiatement
  })
  if (publish.outcome === 'skipped') {
    return { ok: false, error: 'Aucune annotation nouvelle à publier', status: 409 }
  }

  return {
    ok: true,
    prNumber: publish.prNumber ?? null,
    prUrl: publish.prUrl ?? null,
    merged: publish.outcome === 'merged',
  }
}

/** Refuse une annotation. */
export async function rejectAnnotation(id: string): Promise<ModerationResult> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré', status: 500 }

  const { data, error } = await admin
    .from('annotations')
    .update({ status: 'rejected' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[moderation] reject annotation:', error.message)
    return { ok: false, error: 'Impossible de mettre à jour l’annotation', status: 500 }
  }
  if (!data) return { ok: false, error: 'Annotation introuvable ou déjà traitée', status: 404 }
  return { ok: true, prNumber: null, prUrl: null }
}
