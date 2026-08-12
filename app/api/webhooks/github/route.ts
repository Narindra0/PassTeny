import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { recalcReputation } from '@/lib/reputation'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Webhook GitHub — `pull_request` merged sur le repo content.
 *
 * 1. Vérifie la signature HMAC (GITHUB_WEBHOOK_SECRET).
 * 2. Passe les annotations liées à la PR en `merged`.
 * 3. Recalcule la réputation des auteurs et des votants.
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

  const admin = getSupabaseAdmin()
  if (!admin) return Response.json({ error: 'Supabase non configuré' }, { status: 500 })

  // Récupère les annotations liées à cette PR (statut `approved`).
  const { data: annotations } = await admin
    .from('annotations')
    .select('id, author_id, status')
    .eq('pr_number', payload.number)
    .in('status', ['approved'])

  if (!annotations || annotations.length === 0) {
    return Response.json({ ok: true, merged: 0 })
  }

  await admin
    .from('annotations')
    .update({ status: 'merged' })
    .eq('pr_number', payload.number)
    .in('status', ['approved'])

  // Réputation : auteurs + votants de ces annotations.
  const annotationIds = annotations.map((a) => a.id)
  const { data: votes } = await admin
    .from('votes')
    .select('voter_id')
    .in('annotation_id', annotationIds)

  const affected = new Set<string>()
  for (const ann of annotations) {
    if (ann.author_id) affected.add(ann.author_id)
  }
  for (const vote of votes ?? []) affected.add(vote.voter_id)
  await Promise.all([...affected].map((id) => recalcReputation(id)))

  return Response.json({ ok: true, merged: annotations.length })
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
