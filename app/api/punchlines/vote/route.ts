import { getSessionUser } from '@/lib/auth'
import { votePunchline, removeVotePunchline } from '@/lib/punchlines'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: 'Connectez-vous pour voter.' }, { status: 401 })
  }

  const { punchlineId, value } = await request.json().catch(() => ({}))

  if (typeof punchlineId !== 'string' || !punchlineId) {
    return Response.json({ error: 'Punchline invalide.' }, { status: 400 })
  }

  // value = 1 ou -1 pour voter, 0 pour retirer le vote
  if (value === 0 || value === null) {
    const result = await removeVotePunchline(user, punchlineId)
    if (!result.ok) return Response.json({ error: result.error }, { status: 500 })
    return Response.json({ ok: true, score: result.score, myVote: 0 })
  }

  if (value !== 1 && value !== -1) {
    return Response.json({ error: 'Vote invalide.' }, { status: 400 })
  }

  const result = await votePunchline(user, punchlineId, value)
  if (!result.ok) return Response.json({ error: result.error }, { status: 500 })

  return Response.json({ ok: true, score: result.score, myVote: value })
}
