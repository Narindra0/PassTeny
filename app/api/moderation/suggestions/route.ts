import { requireModerator, listSuggestionQueue } from '@/lib/moderation'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

/**
 * GET /api/moderation/suggestions — la file des suggestions de lyrics.
 * Réservé aux modérateurs. Ajoute le pseudo de l'auteur à chaque ligne.
 */
export async function GET() {
  try {
    await requireModerator()
    const queue = await listSuggestionQueue(50)

    const admin = getSupabaseAdmin()
    let usernameById = new Map<string, string>()
    if (admin && queue.length > 0) {
      const authorIds = [...new Set(queue.map((s) => s.author_id))]
      const { data } = await admin.from('profiles').select('id, username').in('id', authorIds)
      usernameById = new Map((data ?? []).map((p) => [p.id, p.username]))
    }

    return Response.json({
      suggestions: queue.map((s) => ({ ...s, author: usernameById.get(s.author_id) ?? 'inconnu' })),
    })
  } catch (err) {
    return routeError(err)
  }
}
