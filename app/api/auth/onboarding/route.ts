import { requireUser } from '@/lib/auth'
import { completeOnboarding } from '@/lib/profiles'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/onboarding — complète l'onboarding du premier login :
 * pseudo choisi (unique) + liens Facebook / Instagram optionnels.
 */
export async function POST(request: Request) {
  const user = await requireUser()

  const body = await request.json().catch(() => ({}))
  const result = await completeOnboarding(user.id, {
    username: typeof body.username === 'string' ? body.username : '',
    facebook_url: typeof body.facebook_url === 'string' ? body.facebook_url : null,
    instagram_url: typeof body.instagram_url === 'string' ? body.instagram_url : null,
  })

  if (!result.ok) {
    const status = result.field === 'username' ? 409 : 400
    return Response.json({ error: result.error, field: result.field }, { status })
  }

  return Response.json({ ok: true })
}
