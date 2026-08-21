/**
 * Punchlines — paroles marquantes proposées et votées par la communauté.
 */
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server'
import type { SessionUser } from '@/lib/auth'

export interface Punchline {
  id: string
  quote: string
  body: string
  score: number
  author: string
  authorId: string
  songId: string
  songTitle: string
  artistName: string
  artistSlug: string
  tags: string[]
  myVote: 1 | -1 | 0
  createdAt: string
}

/** Récupère les punchlines approuvées + les top pending (pour les tops). */
export async function listTopPunchlines(limit = 16, viewerId?: string): Promise<Punchline[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []

  const { data: punchlines } = await supabase
    .from('punchlines')
    .select('id, song_id, quote, context, score, author_id, status, created_at')
    .eq('status', 'approved')
    .order('score', { ascending: false })
    .limit(limit)

  if (!punchlines || punchlines.length === 0) return []

  // Contexte des titres
  const songIds = [...new Set(punchlines.map((p) => p.song_id))]
  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist_name, artist_slug')
    .in('id', songIds)
  const songById = new Map((songs ?? []).map((s) => [s.id, s]))

  // Auteurs
  const authorIds = [...new Set(punchlines.map((p) => p.author_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', authorIds)
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p.username]))

  // Votes du viewer
  let myVotes = new Map<string, 1 | -1>()
  if (viewerId) {
    const pIds = punchlines.map((p) => p.id)
    const { data: votes } = await supabase
      .from('punchline_votes')
      .select('punchline_id, value')
      .eq('voter_id', viewerId)
      .in('punchline_id', pIds)
    myVotes = new Map((votes ?? []).map((v) => [v.punchline_id, v.value as 1 | -1]))
  }

  return punchlines.map((p) => {
    const song = songById.get(p.song_id)
    return {
      id: p.id,
      quote: p.quote,
      body: p.context ?? '',
      score: p.score,
      author: profileById.get(p.author_id) ?? 'anonyme',
      authorId: p.author_id,
      songId: p.song_id,
      songTitle: song?.title ?? p.song_id,
      artistName: song?.artist_name ?? '',
      artistSlug: song?.artist_slug ?? '',
      tags: [],
      myVote: myVotes.get(p.id) ?? 0,
      createdAt: p.created_at,
    }
  })
}

/** Soumet une punchline. */
export async function submitPunchline(
  user: SessionUser,
  songId: string,
  quote: string,
  context?: string,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré' }

  const { data, error } = await admin
    .from('punchlines')
    .insert({
      song_id: songId,
      quote: quote.trim(),
      context: context?.trim() || null,
      author_id: user.id,
      status: 'approved', // auto-approve pour commencer
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id }
}

/** Vote sur une punchline (+1 ou -1). Upsert — un seul vote par profil. */
export async function votePunchline(
  user: SessionUser,
  punchlineId: string,
  value: 1 | -1,
): Promise<{ ok: boolean; error?: string; score?: number }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré' }

  const { error } = await admin
    .from('punchline_votes')
    .upsert(
      { punchline_id: punchlineId, voter_id: user.id, value },
      { onConflict: 'punchline_id,voter_id' }
    )

  if (error) return { ok: false, error: error.message }

  // Récupérer le score mis à jour
  const { data: punchline } = await admin
    .from('punchlines')
    .select('score')
    .eq('id', punchlineId)
    .single()

  return { ok: true, score: punchline?.score ?? 0 }
}

/** Supprime le vote d'un utilisateur sur une punchline. */
export async function removeVotePunchline(
  user: SessionUser,
  punchlineId: string,
): Promise<{ ok: boolean; error?: string; score?: number }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré' }

  const { error } = await admin
    .from('punchline_votes')
    .delete()
    .eq('punchline_id', punchlineId)
    .eq('voter_id', user.id)

  if (error) return { ok: false, error: error.message }

  const { data: punchline } = await admin
    .from('punchlines')
    .select('score')
    .eq('id', punchlineId)
    .single()

  return { ok: true, score: punchline?.score ?? 0 }
}
