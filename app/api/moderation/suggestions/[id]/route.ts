import { requireModerator, approveSuggestion, rejectSuggestion } from '@/lib/moderation'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

/**
 * POST /api/moderation/suggestions/{id} — approuver ou refuser une
 * suggestion de lyrics. L'approbation ouvre la PR sur le repo content
 * (ou la marque `approved` si la PR existe déjà). Réservé aux modérateurs.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'Action invalide (approve ou reject)' }, { status: 400 })
    }

    const result = action === 'approve' ? await approveSuggestion(id) : await rejectSuggestion(id)
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
    return Response.json({ ok: true, prNumber: result.prNumber, prUrl: result.prUrl })
  } catch (err) {
    return routeError(err)
  }
}
