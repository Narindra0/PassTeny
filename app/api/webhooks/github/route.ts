import { createHmac, timingSafeEqual } from 'node:crypto'
import { markPrMerged } from '@/lib/prService'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Webhook GitHub — `pull_request` merged sur le repo content.
 *
 * 1. Vérifie la signature HMAC (GITHUB_WEBHOOK_SECRET).
 * 2. Passe les annotations et suggestions de lyrics liées à la PR en `merged`
 *    et recalcule la réputation (via `markPrMerged`, partagé avec l'auto-merge
 *    déclenché depuis l'app).
 *
 * Sécurité : consomme le corps brut pour la vérification, répond vite.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'Webhook non configuré' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const event = request.headers.get('x-github-event')

  // Vérification de la signature.
  if (signature) {
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
    const ok = safeEqual(expected, signature)
    if (!ok) return Response.json({ error: 'Signature invalide' }, { status: 401 })
  } else {
    return Response.json({ error: 'Signature manquante' }, { status: 401 })
  }

  // Ignorer les événements non liés aux merges de PR.
  if (event !== 'pull_request') return Response.json({ ok: true })

  let payload: {
    action?: string
    number?: number
    pull_request?: { merged?: boolean }
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Payload invalide' }, { status: 400 })
  }

  if (payload.action !== 'closed' || payload.pull_request?.merged !== true || !payload.number) {
    return Response.json({ ok: true, ignored: true })
  }

  const merged = await markPrMerged(payload.number)

  return Response.json({ ok: true, merged })
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
