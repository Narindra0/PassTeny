import { requireUser } from '@/lib/auth'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profiles'
import { publishAnnotations } from '@/lib/prService'
import { routeError } from '@/lib/routeError'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/annotations/:id/vote — vote ±1 d'un contributeur de confiance+.
 * À chaque vote : recalcul du score, puis déclenchement du pipeline PR
 * quand le seuil `auto_pr.min_net_votes` est atteint.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    return await handleVote(request, id)
  } catch (err) {
    return routeError(err)
  }
}

async function handleVote(request: NextRequest, id: string) {
  const user = await requireUser()
  const { value } = await request.json().catch(() => ({}))

  const supabase = await createClient()
  const admin = getSupabaseAdmin()
  if (!supabase || !admin) {
    return Response.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const profile = await getProfile(user.id)
  if (!profile || (profile.role !== 'trusted' && profile.role !== 'moderator')) {
    return Response.json({ error: 'Réservé aux contributeurs de confiance' }, { status: 403 })
  }

  const vote = value === -1 ? -1 : 1

  const { error: voteError } = await supabase.from('votes').upsert(
    { annotation_id: id, voter_id: user.id, value: vote },
    { onConflict: 'annotation_id,voter_id' },
  )
  if (voteError) {
    console.error('[vote] upsert:', voteError.message)
    return Response.json({ error: 'Impossible d’enregistrer le vote' }, { status: 500 })
  }

  // Recalcul du score (trigger SQL) puis lecture.
  const { data: annotation } = await admin
    .from('annotations')
    .select('id, song_id, score, status, songs!inner(artist_slug)')
    .eq('id', id)
    .single()

  if (!annotation) {
    return Response.json({ error: 'Annotation introuvable' }, { status: 404 })
  }

  // Seuil atteint → ouverture de la PR sur le repo content.
  const { data: settingsRows } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'auto_pr')
    .single()
  const minNetVotes = (settingsRows?.value as { min_net_votes?: number } | undefined)?.min_net_votes ?? 3

  let pipeline: { outcome: string; prNumber?: number; prUrl?: string } | null = null
  if (annotation.status === 'pending' && (annotation.score ?? 0) >= minNetVotes) {
    const { data: full } = await admin
      .from('annotations')
      .select('id, song_id, start_offset, end_offset, quote, body, tags, author_id, created_at, updated_at')
      .eq('id', id)
      .single()

    if (full) {
      pipeline = await publishAnnotations({
        songId: full.song_id,
        artistSlug: annotation.songs?.artist_slug ?? '',
        annotationIds: [full.id],
        annotations: [
          {
            id: makeGithubId(full.id),
            start: full.start_offset,
            end: full.end_offset,
            quote: full.quote,
            body: full.body,
            tags: full.tags ?? [],
            author: 'pass-teny',
            createdAt: full.created_at,
            updatedAt: full.updated_at,
            authorId: full.author_id,
          },
        ],
      })
    }
  }

  return Response.json({
    ok: true,
    score: annotation.score,
    status: annotation.status,
    pipeline,
  })
}

/** Id stable de l'annotation dans le repo content (uuid → short). */
function makeGithubId(supabaseId: string): string {
  return `a_${supabaseId.replace(/-/g, '').slice(0, 12)}`
}
