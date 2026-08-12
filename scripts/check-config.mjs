#!/usr/bin/env node
/**
 * Pass'Teny — Vérification approfondie de la configuration (Phase 0 → Phase 1).
 *
 * Teste :
 *  1. Présence des variables (préfixe + longueur uniquement, jamais les valeurs)
 *  2. Supabase : toutes les tables du schéma, lecture anon (RLS), auth (providers)
 *  3. GitHub : token + accès repo content + lecture raw (utilisée en production)
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

// ── 1. Variables ─────────────────────────────────────────────────────────────
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

// ── 2. Supabase : tables, RLS, auth ──────────────────────────────────────────
const head = (key) => ({ apikey: key, Authorization: `Bearer ${key}` })

async function restQuery(key, pathname, qs = '') {
  try {
    const res = await fetch(`${base}${pathname}?${qs || 'select=*&limit=1'}`, {
      headers: { ...head(key), Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    return { status: res.status, body: await res.text() }
  } catch (err) {
    return { status: 0, body: `network: ${err.message}` }
  }
}

const TABLES = ['profiles', 'songs', 'annotations', 'annotation_versions', 'votes', 'glossary_terms', 'settings']

if (base.startsWith('https://') && anon && srv) {
  // a) Chaque table du schéma existe-t-elle ? (service_role = bypass RLS)
  const exists = await Promise.all(TABLES.map((t) => restQuery(srv, `/rest/v1/${t}`, `select=*&limit=1`)))
  const missing = TABLES.filter((_, i) => exists[i].status !== 200)
  check(
    'Supabase : les 7 tables du schéma existent',
    missing.length === 0,
    missing.length === 0
      ? TABLES.join(', ')
      : `manquantes/err: ${missing.map((m, i) => `${TABLES[i]}=${exists[TABLES.indexOf(m)].status}`).join(', ')}`,
  )

  // b) Lecture anon : les policies RLS read doivent laisser passer (tables vides → [])
  const anonReads = await Promise.all(TABLES.map((t) => restQuery(anon, `/rest/v1/${t}`, `select=*&limit=1`)))
  const anonBlocked = TABLES.filter((_, i) => anonReads[i].status !== 200)
  check(
    'Supabase : lecture anon OK (policies RLS actives)',
    anonBlocked.length === 0,
    anonBlocked.length === 0
      ? 'lecture publique fonctionnelle'
      : `bloquées: ${anonBlocked.map((t) => `${t}=${anonReads[TABLES.indexOf(t)].status}`).join(', ')}`,
  )

  // c) Les seeds de `settings` sont-ils présents ? (preuve que schema.sql a tourné)
  const settingsRead = await restQuery(anon, '/rest/v1/settings', 'select=key&order=key')
  let settingsOk = false
  let settingsDetail = ''
  if (settingsRead.status === 200) {
    try {
      const keys = JSON.parse(settingsRead.body).map((r) => r.key)
      settingsOk = ['reputation', 'roles', 'auto_pr', 'auto_merge', 'moderation'].every((k) => keys.includes(k))
      settingsDetail = settingsOk ? `seeds présents (${keys.join(', ')})` : `seeds partiels: ${keys.join(', ')}`
    } catch {
      settingsDetail = 'réponse illisible'
    }
  } else {
    settingsDetail = `status ${settingsRead.status}`
  }
  check('Supabase : seeds des réglages présents (schema.sql exécuté)', settingsOk, settingsDetail)

  // d) Service d'auth : providers email (magic link)
  const authRes = await restQuery(anon, '/auth/v1/settings')
  const authOk = authRes.status === 200 && authRes.body.includes('email')
  check(
    'Supabase : service Auth up (provider email)',
    authOk,
    authOk ? 'magic link / email disponibles' : `status ${authRes.status}`,
  )
} else {
  check('Supabase : tests', false, 'variables Supabase incomplètes — tests ignorés')
}

// ── 3. GitHub : token, repo content, lecture raw (prod) ──────────────────────
if (token && /^[^/]+\/[^/]+$/.test(repo)) {
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'pass-teny' },
      signal: AbortSignal.timeout(15000),
    })
    check('GitHub : token valide', userRes.status === 200, userRes.status === 200 ? 'authentifié' : `status ${userRes.status}`)

    const contentRes = await fetch(`https://api.github.com/repos/${repo}/contents/`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'pass-teny' },
      signal: AbortSignal.timeout(15000),
    })
    const hasFiles = contentRes.status === 200 && (await contentRes.json()).length > 0
    check(
      `GitHub : accès au repo ${repo}`,
      contentRes.status === 200 && hasFiles,
      hasFiles ? 'contenu présent' : `status ${contentRes.status}${contentRes.status === 404 ? ' (introuvable)' : ''}`,
    )

    // Le mode production lit via raw.githubusercontent.com — test réel du pipeline.
    const rawRes = await fetch(`https://raw.githubusercontent.com/${repo}/main/index.json`, {
      signal: AbortSignal.timeout(15000),
    })
    let rawOk = false
    let rawDetail = `status ${rawRes.status}`
    if (rawRes.status === 200) {
      try {
        const idx = await rawRes.json()
        rawOk = Array.isArray(idx.songs) && idx.songs.length > 0
        rawDetail = `index.json lisible (${idx.songs.length} titres)`
      } catch {
        rawDetail = 'index.json illisible'
      }
    }
    check('GitHub : lecture raw OK (mode production)', rawOk, rawDetail)
  } catch (err) {
    check('GitHub : tests', false, `network: ${err.message}`)
  }
} else {
  check('GitHub : tests', false, 'GITHUB_TOKEN ou CONTENT_REPO manquant — tests ignorés')
}

// ── Rapport ──────────────────────────────────────────────────────────────────
console.log('\n── Vérification approfondie Pass’Teny ──\n')
for (const line of results) console.log(line)
const fails = results.filter((r) => r.startsWith('❌')).length
const warns = results.filter((r) => r.startsWith('⚠')).length
console.log(`\n${results.length - fails - warns} ✅ · ${warns} ⚠️ · ${fails} ❌`)
process.exit(fails > 0 ? 1 : 0)
