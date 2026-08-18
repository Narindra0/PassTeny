import type { NextRequest } from 'next/server'
import { handleAuthCallback } from '@/lib/authCallback'

/**
 * GET /auth/callback — l'URL que Supabase utilise dans `emailRedirectTo`.
 * Sans cette route, le lien magique tombait sur une 404 (la logique ne
 * vivait que dans /api/auth/callback).
 */
export async function GET(request: NextRequest) {
  return handleAuthCallback(request)
}
