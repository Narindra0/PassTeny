import type { NextRequest } from 'next/server'
import { handleAuthCallback } from '@/lib/authCallback'

/**
 * GET /api/auth/callback — compatibilité : les anciens liens magiques qui
 * pointaient vers /api/auth/callback continuent de fonctionner.
 */
export async function GET(request: NextRequest) {
  return handleAuthCallback(request)
}
