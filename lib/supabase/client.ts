/**
 * Client Supabase navigateur (clé anon / publishable).
 * Retourne `null` tant que le projet Supabase n'est pas configuré.
 */
'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, config } from '@/lib/config'
import type { Database } from './database.types'

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient<Database>(config.supabase.url, config.supabase.anonKey)
  }
  return client
}
