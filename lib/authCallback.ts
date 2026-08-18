import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/profiles'

/**
 * Callback Supabase Auth (magic link / OAuth) : échange le code, crée le
 * profil Pass'Teny s'il n'existe pas, redirige vers l'onboarding au premier
 * login, sinon vers `next` (défaut : accueil).
 *
 * Exposé sur `/auth/callback` (l'URL utilisée par `emailRedirectTo` du lien
 * magique) et sur `/api/auth/callback` (compatibilité avec les anciens liens).
 */
export async function handleAuthCallback(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/'

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
      const profile = await ensureProfile({ id: data.user.id, email: data.user.email ?? '' })
      // Premier login : l'onboarding (pseudo + réseaux) est requis avant de continuer.
      if (profile && !profile.onboarding_done) {
        return NextResponse.redirect(
          new URL(`/auth/onboarding?next=${encodeURIComponent(target)}`, requestUrl.origin),
        )
      }
    }
  }

  return NextResponse.redirect(new URL(target, requestUrl.origin))
}
