/**
 * Proxy Pass'Teny — refresh de la session Supabase sur chaque requête
 * (pattern officiel @supabase/ssr). Sans cela, les sessions expirent après
 * 1h sans renouvellement.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Rafraîchit la session si nécessaire (aucune page protégée à ce stade :
  // le refresh suffit, la vérification se fait dans les routes/API).
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et les fichiers publics.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
