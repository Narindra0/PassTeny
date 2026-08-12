import { createClient } from '@/lib/supabase/server'
import { config } from '@/lib/config'

export async function POST(request: Request) {
  const supabase = await createClient()
  if (!supabase) {
    return Response.json({ error: 'Supabase n’est pas configuré' }, { status: 500 })
  }

  const { email } = await request.json().catch(() => ({}))
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${config.siteUrl}/auth/callback`,
    },
  })

  if (error) {
    console.error('[auth/signin]', error.message)
    return Response.json({ error: 'Impossible d’envoyer le lien de connexion' }, { status: 500 })
  }

  return Response.json({ ok: true, message: 'Lien de connexion envoyé' })
}
