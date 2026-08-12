/**
 * Client Supabase serveur (clé service-role).
 *
 * Réservé aux API routes / server components — jamais importé côté client.
 * Retourne `null` tant que les variables ne sont pas configurées
 * (`.env.local`), le pipeline communautaire (phase 1) s'appuie dessus.
 */
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

export type Database = Record<string, unknown>

let adminClient: SupabaseClient<Database> | null = null

/** Client avec la clé service-role : accès complet (modération, PR, réputation). */
export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) return null
  if (!adminClient) {
    adminClient = createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

/** Client anon côté serveur (lecture publique, soumissions authentifiées). */
export function getSupabaseServer(): SupabaseClient<Database> | null {
  if (!config.supabase.url || !config.supabase.anonKey) return null
  return createClient<Database>(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
