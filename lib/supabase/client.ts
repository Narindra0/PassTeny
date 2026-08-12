/**
 * Client Supabase navigateur (clé anon).
 * Retourne `null` tant que le projet Supabase n'est pas configuré
 * (`.env.local`) — le site reste alors en lecture seule sur le repo content.
 */
'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, config } from '@/lib/config'

export type Database = Record<string, unknown>

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient<Database>(config.supabase.url, config.supabase.anonKey)
  }
  return client
}
