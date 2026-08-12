#!/usr/bin/env node
/**
 * Pass'Teny — Indexation du contenu dans Supabase (recherche full-text).
 *
 * Synchronise `content/` (le repo pass-teny-content) vers la table `songs`
 * de Supabase : chaque titre alimente l'index `search` (tsvector, config
 * `simple` + `unaccent`) utilisé par la recherche du site.
 *
 * Option `--seed-glossary` : insère un petit jeu d'ohabolana (proverbes
 * malgaches) approuvés si le glossaire est vide — pour la démo.
 *
 * Usage (depuis PassTeny/) :
 *   node scripts/index-content.mjs
 *   node scripts/index-content.mjs --seed-glossary
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

// ── Environnement (.env.local) ───────────────────────────────────────────────
const env = {}
try {
  for (const line of (await fs.readFile(path.resolve(process.cwd(), '.env.local'), 'utf8')).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  console.error('✗ .env.local introuvable')
  process.exit(1)
}

const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!BASE || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents de .env.local')
  process.exit(1)
}

const CONTENT_DIR = path.resolve(process.cwd(), 'content')
const SEED_GLOSSARY = process.argv.includes('--seed-glossary')

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
}

async function upsertSongs(rows) {
  const out = []
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50)
    const res = await fetch(`${BASE}/rest/v1/songs?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    })
    if (!res.ok) {
      console.error(`  ✗ upsert songs (lot ${i / 50}): ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`)
      process.exitCode = 1
      return
    }
    out.push(chunk.length)
  }
  return out
}

async function main() {
  const index = JSON.parse(await fs.readFile(path.join(CONTENT_DIR, 'index.json'), 'utf8'))
  console.log(`Indexation de ${index.songs.length} titres vers Supabase…`)

  const rows = []
  for (const song of index.songs) {
    const metaPath = path.join(CONTENT_DIR, song.artistSlug, song.slug, 'meta.json')
    const lyricsPath = path.join(CONTENT_DIR, song.artistSlug, song.slug, 'lyrics.txt')
    const [meta, lyrics] = await Promise.all([
      fs.readFile(metaPath, 'utf8').then(JSON.parse).catch(() => null),
      fs.readFile(lyricsPath, 'utf8').catch(() => ''),
    ])
    rows.push({
      id: song.slug,
      artist_slug: song.artistSlug,
      artist_name: meta?.artist || song.artist,
      title: meta?.title || song.title,
      album: meta?.album || song.album || null,
      language: meta?.language ?? [],
      lyrics_txt: lyrics,
    })
  }

  const inserted = await upsertSongs(rows)
  if (inserted) console.log(`✅ ${inserted.reduce((a, b) => a + b, 0)} titres indexés.`)

  // ── Seed glossaire (démo) ───────────────────────────────────────────────
  if (SEED_GLOSSARY) {
    // NB : le GET REST Supabase renvoie un tableau brut (pas { data }).
    const rows = await fetch(`${BASE}/rest/v1/glossary_terms?select=id&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).then((r) => r.json())
    if (rows && rows.length > 0) {
      console.log('Glossaire déjà alimenté — seed ignoré.')
      return
    }

    const ohabolana = [
      { term: 'Ny aina aza very, ny haja no tiana', meaning: 'Même au péril de sa vie, l’honneur se préserve — valeur cardinale du fihavanana.', language: 'mg', example: 'Employé face à une humiliation, il invoque le fihavanana.' },
      { term: 'Tsy misy tsy azo', meaning: 'Tout est possible — rien n’est impossible à qui s’y met.', language: 'mg', example: '« Tsy misy tsy azo » : refrain de motivation dans les hymnes.' },
      { term: 'Aleo very tsikalakalam-bola toy izay very tsikalakalam-pihavanana', meaning: 'Mieux vaut perdre de l’argent que perdre l’harmonie d’une relation.', language: 'mg', example: 'Invoqué quand un litige d’argent menace une amitié.' },
      { term: 'Ny vary voky, ny resaka mahafinaritra', meaning: 'Le ventre plein, la conversation est agréable — l’hospitalité d’abord.', language: 'mg', example: 'Souvent cité autour du repas partagé.' },
      { term: 'Misy ihany ny andro', meaning: 'Le jour viendra — l’espoir et la patience.', language: 'mg', example: 'Titre et refrain populaires du groupe Jaojoby.' },
      { term: 'Volana feno amin’ny fiainana', meaning: 'Pleine lune de la vie — l’apogée, l’accomplissement.', language: 'mg', example: 'Expression poétique de l’épanouissement.' },
    ]

    const res = await fetch(`${BASE}/rest/v1/glossary_terms`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(ohabolana.map((t) => ({ ...t, approved: true }))),
    })
    if (res.ok) console.log(`✅ ${ohabolana.length} ohabolana seedées dans le glossaire.`)
    else console.error(`  ✗ seed glossaire: ${res.status}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
