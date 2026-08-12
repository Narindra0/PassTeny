import { listApprovedTerms, proposeTerm } from '@/lib/glossary'
import { requireUser } from '@/lib/auth'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

export async function GET() {
  const terms = await listApprovedTerms()
  return Response.json({ terms })
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json().catch(() => ({}))
    const { term, meaning, language, example } = body ?? {}

    if (typeof term !== 'string' || term.trim().length < 2) {
      return Response.json({ error: 'Terme trop court' }, { status: 400 })
    }
    if (typeof meaning !== 'string' || meaning.trim().length < 4) {
      return Response.json({ error: 'Explication trop courte' }, { status: 400 })
    }

    const result = await proposeTerm(
      user,
      term,
      meaning,
      typeof language === 'string' ? language : 'mg',
      typeof example === 'string' ? example : undefined,
    )
    if (result.error) return Response.json({ error: result.error }, { status: 500 })
    return Response.json({ ok: true, term: result.data }, { status: 201 })
  } catch (err) {
    return routeError(err)
  }
}
