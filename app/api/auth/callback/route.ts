import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/profiles'

/**
 * Callback Supabase Auth (magic link / OAuth) : échange le code, crée le
 * profil Pass'Teny s'il n'existe pas, puis redirige vers l'accueil.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.redirect(new URL('/auth/signin?error=config', requestUrl.origin))
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback]', error.message)
      return NextResponse.redirect(new URL('/auth/signin?error=auth', requestUrl.origin))
    }
    if (data.user) {
      await ensureProfile({ id: data.user.id, email: data.user.email ?? '' })
    }
  }

  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(new URL(target, requestUrl.origin))
}
