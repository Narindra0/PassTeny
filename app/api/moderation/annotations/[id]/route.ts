import { requireModerator, approveAnnotation, rejectAnnotation } from '@/lib/moderation'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

/**
 * POST /api/moderation/annotations/{id} — approuver ou refuser une soumission
 * d'annotation. L'approbation ouvre la PR sur le repo content et la fusionne
 * immédiatement (auto-merge) : la soumission passe directement à `merged`.
 * Réservé aux modérateurs.
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

    const result = action === 'approve' ? await approveAnnotation(id) : await rejectAnnotation(id)
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
    return Response.json({
      ok: true,
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      merged: result.merged ?? false,
    })
  } catch (err) {
    return routeError(err)
  }
}
