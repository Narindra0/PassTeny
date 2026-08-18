#!/usr/bin/env node
/**
 * Pass'Teny — Migration automatique du schéma Supabase.
 *
 * Applique `schema.sql` au projet Supabase via l'API Management
 * (`POST /v1/projects/{ref}/database/query`) — le même canal que le
 * SQL Editor, sans intervention manuelle.
 *
 * Usage :
 *   npm run db:migrate            # applique, silencieux si non configuré
 *   npm run db:migrate -- --strict  # exit 1 en cas d'échec (CI, deploys)
 *
 * Prérequis : `SUPABASE_ACCESS_TOKEN` dans .env.local (jeton de l'API
 * Management, créé dans Supabase → Account → Access Tokens, permission
 * database write). Sans jeton, le script se contente d'avertir et ne
 * bloque pas le démarrage (dev compris).
 *
 * Le schéma est rejouable (idempotent) : `create table if not exists`,
 * `create or replace function`, `drop policy if exists`, etc.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const strict = process.argv.includes('--strict')

// ── Lecture de .env.local (jamais de valeurs sensibles affichées) ───────────
const env = {}
const envPath = path.join(ROOT, '.env.local')
try {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  console.warn('⚠ .env.local introuvable — migration ignorée.')
  process.exit(strict ? 1 : 0)
}

const token = env.SUPABASE_ACCESS_TOKEN || ''
const baseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')

if (!token) {
  console.warn(
    '⚠ SUPABASE_ACCESS_TOKEN absent — migration ignorée.\n' +
      '  Pour l’auto-migration : Supabase → Account → Access Tokens → générer un jeton\n' +
      '  (permission database write) puis l’ajouter à .env.local.',
  )
  process.exit(strict ? 1 : 0)
}
if (!/^https:\/\/.+\.supabase\.co$/.test(baseUrl)) {
  console.warn('⚠ NEXT_PUBLIC_SUPABASE_URL invalide — migration ignorée.')
  process.exit(strict ? 1 : 0)
}

// ── Exécution ────────────────────────────────────────────────────────────────
const ref = new URL(baseUrl).hostname.split('.')[0]
const sql = readFileSync(path.join(ROOT, 'schema.sql'), 'utf8')

console.log(`→ Application de schema.sql sur le projet ${ref}…`)

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ query: sql }),
  signal: AbortSignal.timeout(60_000),
})

if (res.ok) {
  console.log(`✅ Migration appliquée (${sql.length} caractères) — schéma à jour.`)
  process.exit(0)
}

const detail = (await res.text().catch(() => '')).slice(0, 500)
console.error(`❌ Migration échouée (status ${res.status}).`)
if (detail) console.error(`   ${detail}`)
console.error('   Corrigez le schéma ou appliquez-le à la main dans le SQL Editor.')
process.exit(strict ? 1 : 0)
