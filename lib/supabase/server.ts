/**
 * Clients Supabase côté serveur.
 *
 * - `createClient()` : client de session (cookies) — pour les pages et
 *   API routes qui agissent au nom de l'utilisateur connecté (RLS active).
 * - `getSupabaseAdmin()` : client service-role — réservé aux écritures
 *   système (profil, index des chansons, réputation). Bypass RLS.
 * - `getSupabaseServer()` : client anon pour les lectures publiques.
 *
 * Aucun de ces clients ne doit jamais être importé côté navigateur.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseJs, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import type { Database } from './database.types'

/** Client de session utilisateur (cookies) — RLS respectée. */
export async function createClient(): Promise<SupabaseClient<Database> | null> {
  if (!config.supabase.url || !config.supabase.anonKey) return null
  const cookieStore = await cookies()
  return createServerClient<Database>(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Appelé depuis un Server Component (lecture seule) : le refresh
          // de session est alors géré par le middleware.
        }
      },
    },
  })
}

let adminClient: SupabaseClient<Database> | null = null

/** Client service-role : accès complet, bypass RLS (serveur uniquement). */
export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) return null
  if (!adminClient) {
    adminClient = createSupabaseJs<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

/** Client anon pour les lectures publiques côté serveur. */
export function getSupabaseServer(): SupabaseClient<Database> | null {
  if (!config.supabase.url || !config.supabase.anonKey) return null
  return createSupabaseJs<Database>(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
