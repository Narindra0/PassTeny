/**
 * Helpers d'authentification — session utilisateur côté serveur.
 */
import { createClient } from '@/lib/supabase/server'

export interface SessionUser {
  id: string
  email: string
}

/** Retourne l'utilisateur connecté, ou null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? '' }
}

/** Retourne l'utilisateur connecté ou lève une erreur (pour les API routes). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    const err = new Error('Authentification requise') as Error & { status?: number }
    err.status = 401
    throw err
  }
  return user
}
