#!/usr/bin/env node
/**
 * Pass'Teny — Vérification de la configuration (Phase 0 → Phase 1).
 *
 * Teste la présence des variables, la connexion Supabase (tables + RLS en
 * mode anon) et l'accès du token GitHub au repo content — SANS révéler
 * les valeurs des secrets (préfixe + longueur uniquement).
 *
 * Usage : node scripts/check-config.mjs   (depuis le dossier PassTeny)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
const env = {}

try {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  console.error(`✗ ${envPath} introuvable — créez-le depuis .env.example`)
  process.exit(1)
}

const mask = (v) => (v ? `${v.slice(0, 8)}… (${v.length} caractères)` : '(vide)')
const results = []
const check = (label, ok, detail = '') => {
  results.push(`${ok ? '✅' : detail.startsWith('⚠') ? '⚠️' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
}

// ── 1. Présence des variables ────────────────────────────────────────────────
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const srv = env.SUPABASE_SERVICE_ROLE_KEY || ''
const base = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const token = env.GITHUB_TOKEN || ''
const repo = env.CONTENT_REPO || ''

const urlHost = (u) => {
  try {
    return new URL(u).host
  } catch {
    return '(format invalide — attendu https://xxxx.supabase.co)'
  }
}

check(
  'NEXT_PUBLIC_SUPABASE_URL',
  base.startsWith('https://') && base.includes('.supabase.co'),
  base ? urlHost(base) : 'absente',
)
check('NEXT_PUBLIC_SUPABASE_ANON_KEY', anon.length >= 20, anon ? `présente (${mask(anon)})` : 'absente')
check('SUPABASE_SERVICE_ROLE_KEY', srv.length >= 20, srv ? `présente (${mask(srv)})` : 'absente')
check('GITHUB_TOKEN', token.length >= 10, token ? `présente (${mask(token)})` : 'absente')
check('CONTENT_REPO', /^[^/]+\/[^/]+$/.test(repo), repo ? repo : 'absente')

// ── 2. Supabase : connexion, tables, RLS anon ────────────────────────────────
const head = (key) => ({ apikey: key, Authorization: `Bearer ${key}` })

async function restQuery(key, table, qs = '') {
  try {
    const res = await fetch(`${base}/rest/v1/${table}?${qs || 'select=*&limit=1'}`, {
      headers: { ...head(key), Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    return { status: res.status, body: await res.text() }
  } catch (err) {
    return { status: 0, body: `network: ${err.message}` }
  }
}

if (base.startsWith('https://') && anon && srv) {
  // Tables accessibles en lecture anon (RLS read policies) :
  // settings (peuplée par le seed SQL) et songs (vide, doit exister).
  const [anonSettings, anonSongs, srvSettings, srvProfiles] = await Promise.all([
    restQuery(anon, 'settings', 'select=key&limit=3'),
    restQuery(anon, 'songs', 'select=id&limit=1'),
    restQuery(srv, 'settings', 'select=key&limit=3'),
    restQuery(srv, 'profiles', 'select=id&limit=1'),
  ])

  const settingsOk = anonSettings.status === 200
  check(
    'Supabase : table settings lisible en anon (RLS)',
    settingsOk,
    settingsOk
      ? `retourne des données (${anonSettings.body.includes('reputation') ? 'seeds présents' : 'table présente'})`
      : `status ${anonSettings.status}${anonSettings.body.slice(0, 120)}`,
  )
  const songsOk = anonSongs.status === 200
  check(
    'Supabase : table songs présente (RLS lecture publique)',
    songsOk,
    songsOk ? 'table présente (vide, normal avant l’indexation)' : `status ${anonSongs.status} ${anonSongs.body.slice(0, 120)}`,
  )
  const srvOk = srvSettings.status === 200 && srvProfiles.status === 200
  check(
    'Supabase : clé service_role fonctionnelle',
    srvOk,
    srvOk ? `lecture OK (settings ${srvSettings.status}, profiles ${srvProfiles.status})` : `settings ${srvSettings.status} / profiles ${srvProfiles.status}`,
  )
} else {
  check('Supabase : tests de connexion', false, 'variables Supabase incomplètes — tests ignorés')
}

// ── 3. GitHub : token + accès au repo content ────────────────────────────────
if (token && /^[^/]+\/[^/]+$/.test(repo)) {
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'pass-teny' },
      signal: AbortSignal.timeout(15000),
    })
    check(
      'GitHub : token valide',
      userRes.status === 200,
      userRes.status === 200 ? `authentifié` : `status ${userRes.status} (token invalide ou révoqué)`,
    )

    const contentRes = await fetch(`https://api.github.com/repos/${repo}/contents/`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'pass-teny' },
      signal: AbortSignal.timeout(15000),
    })
    const hasFiles = contentRes.status === 200 && (await contentRes.json()).length > 0
    check(
      `GitHub : accès au repo ${repo}`,
      contentRes.status === 200,
      hasFiles ? 'repo accessible, contenu présent' : `status ${contentRes.status}${contentRes.status === 404 ? ' (repo introuvable ou non accessible)' : ''}`,
    )
  } catch (err) {
    check('GitHub : tests', false, `network: ${err.message}`)
  }
} else {
  check('GitHub : tests', false, 'GITHUB_TOKEN ou CONTENT_REPO manquant — tests ignorés')
}

// ── Rapport ──────────────────────────────────────────────────────────────────
console.log('\n── Vérification de la configuration Pass’Teny ──\n')
for (const line of results) console.log(line)
const fails = results.filter((r) => r.startsWith('❌')).length
const warns = results.filter((r) => r.startsWith('⚠')).length
console.log(`\n${results.length - fails - warns} ✅ · ${warns} ⚠️ · ${fails} ❌`)
process.exit(fails > 0 ? 1 : 0)
