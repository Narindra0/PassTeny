import { getSessionUser } from '@/lib/auth'
import { submitPunchline } from '@/lib/punchlines'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: 'Connectez-vous pour proposer une punchline.' }, { status: 401 })
  }

  const { songId, quote, context } = await request.json().catch(() => ({}))

  if (typeof songId !== 'string' || !songId) {
    return Response.json({ error: 'Titre invalide.' }, { status: 400 })
  }
  if (typeof quote !== 'string' || quote.trim().length < 4) {
    return Response.json({ error: 'La punchline doit contenir au moins 4 caractères.' }, { status: 400 })
  }
  if (quote.length > 300) {
    return Response.json({ error: 'La punchline ne peut dépasser 300 caractères.' }, { status: 400 })
  }

  const result = await submitPunchline(user, songId, quote, context)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 })
  }

  return Response.json({ ok: true, id: result.id })
}
