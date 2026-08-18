#!/usr/bin/env node
/**
 * Pass'Teny — Synchronise les lyrics depuis l'API live Pass'io.
 *
 * Le seed initial (`seed-from-passio.mjs`) s'appuie sur un dump de sauvegarde :
 * les paroles ajoutées sur Pass'io depuis tombent dans le vide. Ce script
 * interroge l'API **live** et ajoute au catalogue tout titre qui a des paroles
 * et n'y est pas encore (dédupliqué par passio trackId).
 *
 * Idempotent et non destructif :
 *  - les titres déjà présents (avec ou sans lyrics) ne sont pas réécrits ;
 *  - `index.json` est mis à jour par ajout uniquement (rien n'est retiré).
 *
 * Usage :
 *   node scripts/sync-lyrics-from-passio.mjs          # ajoute les manquants
 *   node scripts/sync-lyrics-from-passio.mjs --dry-run
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve(process.cwd(), 'content')
const API_BASE = process.env.PASSIO_API_BASE || 'https://pass-io.onrender.com'
const CONCURRENCY = 6
const DRY_RUN = process.argv.includes('--dry-run')

// ── Utils ────────────────────────────────────────────────────────────────────
function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function dedupeSlug(base, taken) {
  let slug = base
  let i = 2
  while (taken.has(slug)) slug = `${base}-${i++}`
  taken.add(slug)
  return slug
}

async function fetchJson(p) {
  const res = await fetch(`${API_BASE}${p}`, {
    headers: { 'x-preview-mode': 'true', Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchLyrics(trackId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/albums/tracks/${trackId}/lyrics`, {
        headers: { 'x-preview-mode': 'true' },
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 200) return await res.text()
      if (res.status === 403 || res.status === 404) return null
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
  }
  return null
}

function lrcToPlainText(lrc) {
  const seen = new Set()
  const lines = []
  for (const raw of lrc.split(/\r?\n/)) {
    const text = raw.replace(/^\[[^\]]*\](?:\s*\[[^\]]*\])*/g, '').trim()
    if (!text) continue
    if (seen.has(text)) continue
    seen.add(text)
    lines.push(text)
  }
  return lines.join('\n')
}

async function exists(p) {
  return fs.access(p).then(() => true).catch(() => false)
}

// ── Index live Pass'io (albums → tracklists) ────────────────────────────────
async function buildLiveIndex() {
  const albums = (await fetchJson('/api/albums')) ?? []
  const hits = []
  for (let i = 0; i < albums.length; i += 20) {
    const batch = albums.slice(i, i + 20)
    const details = await Promise.all(
      batch.map(async (album) => {
        const d = await fetchJson(`/api/albums/${album.id}`)
        return d ? { album, tracks: d.tracks ?? [] } : null
      }),
    )
    for (const d of details) {
      if (!d) continue
      for (const t of d.tracks) {
        hits.push({
          id: t.id,
          title: t.title,
          position: t.position,
          artistName: d.album.artist_name ?? 'Artiste inconnu',
          albumTitle: d.album.title,
          albumId: d.album.id,
          coverUrl: d.album.cover_url,
          hasLyrics: t.has_lyrics === true,
        })
      }
    }
  }
  return hits
}

// ── Chargement de l'existant ────────────────────────────────────────────────
async function loadExisting() {
  const indexPath = path.join(OUT_DIR, 'index.json')
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'))

  // artist name (meta) → slug du dossier existant.
  const artistNameToSlug = new Map()
  const existingArtistSlugs = new Set(index.artists.map((a) => a.slug))
  for (const artist of index.artists) {
    artistNameToSlug.set(artist.name.trim().toLowerCase(), artist.slug)
  }

  // songSlug → passio trackId (déduplication).
  const trackIdBySlug = new Map()
  for (const song of index.songs) {
    const mf = path.join(OUT_DIR, song.artistSlug, song.slug, 'meta.json')
    try {
      const meta = JSON.parse(await fs.readFile(mf, 'utf8'))
      trackIdBySlug.set(`${song.artistSlug}/${song.slug}`, meta.source?.trackId ?? null)
    } catch {
      /* meta absent : ignoré */
    }
  }
  return { index, artistNameToSlug, existingArtistSlugs, trackIdBySlug }
}

async function main() {
  const { index, artistNameToSlug, existingArtistSlugs, trackIdBySlug } = await loadExisting()
  const live = await buildLiveIndex()
  const withLyrics = live.filter((t) => t.hasLyrics)
  console.log(`Pass'io live : ${live.length} pistes, ${withLyrics.length} avec paroles.`)

  // Titres manquants (pas de trackId déjà présent dans le catalogue).
  const existingIds = new Set(trackIdBySlug.values())
  const missing = withLyrics.filter((t) => !existingIds.has(t.id))

  // Regroupe par artiste pour les slugs de chansons (déduplication par artiste).
  const byArtist = new Map()
  for (const t of missing) {
    const key = t.artistName.trim()
    if (!byArtist.has(key)) byArtist.set(key, [])
    byArtist.get(key).push(t)
  }

  console.log(`Manquants dans Pass'Teny : ${missing.length} titres (${byArtist.size} artistes).`)
  for (const [artist, tracks] of byArtist) console.log(`  ${artist} → ${tracks.length}`)
  if (missing.length === 0) {
    console.log('Rien à synchroniser — le catalogue est à jour.')
    return
  }

  let added = 0
  let failed = 0

  const run = async (track) => {
    const name = track.artistName.trim()
    // Slug artiste : réutilise l'existant si connu, sinon nouveau.
    let artistSlug = artistNameToSlug.get(name.toLowerCase())
    if (!artistSlug) {
      artistSlug = dedupeSlug(slugify(name) || 'artiste', existingArtistSlugs)
      artistNameToSlug.set(name.toLowerCase(), artistSlug)
    }

    const perArtist = new Set(
      index.songs.filter((s) => s.artistSlug === artistSlug).map((s) => s.slug),
    )
    const songSlug = dedupeSlug(slugify(track.title) || 'titre', perArtist)

    const dir = path.join(OUT_DIR, artistSlug, songSlug)
    const lrcPath = path.join(dir, 'lyrics.lrc')
    if (await exists(lrcPath)) return // déjà présent

    const lrc = await fetchLyrics(track.id)
    if (!lrc) {
      console.warn(`  ⚠ « ${track.title} » (${name}) : lyrics introuvables via l'API.`)
      failed++
      return
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] + ${name} — « ${track.title} » → ${artistSlug}/${songSlug}`)
      return
    }

    const meta = {
      id: songSlug,
      title: track.title,
      artist: name,
      artists: [name],
      album: track.albumTitle,
      albumSlug: slugify(track.albumTitle) || null,
      releaseDate: null,
      coverUrl: track.coverUrl,
      language: [],
      tags: [],
      source: {
        platform: 'passio',
        albumId: track.albumId,
        trackId: track.id,
        albumTitle: track.albumTitle,
        note: 'Synchro lyrics Pass’io',
      },
      addedAt: new Date().toISOString().slice(0, 10),
    }
    await fs.mkdir(dir, { recursive: true })
    await Promise.all([
      fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n'),
      fs.writeFile(path.join(dir, 'annotations.json'), JSON.stringify({ annotations: [] }, null, 2) + '\n'),
      fs.writeFile(lrcPath, lrc),
      fs.writeFile(path.join(dir, 'lyrics.txt'), lrcToPlainText(lrc) + '\n'),
    ])
    // Nouvel artiste → entrée dans index.json.
    if (!index.artists.some((a) => a.slug === artistSlug)) {
      index.artists.push({ slug: artistSlug, name, coverUrl: track.coverUrl })
    }
    index.songs.push({
      slug: songSlug,
      artistSlug,
      artist: name,
      title: track.title,
      album: track.albumTitle,
      coverUrl: track.coverUrl,
    })
    added++
    console.log(`  + ${name} — « ${track.title} » (${artistSlug}/${songSlug})`)
  }

  for (const tracks of byArtist.values()) {
    for (let i = 0; i < tracks.length; i += CONCURRENCY) {
      await Promise.all(tracks.slice(i, i + CONCURRENCY).map(run))
    }
  }

  if (!DRY_RUN && added > 0) {
    index.generatedAt = new Date().toISOString()
    await fs.writeFile(
      path.join(OUT_DIR, 'index.json'),
      JSON.stringify(index, null, 2) + '\n',
    )
  }

  console.log(
    `\nTerminé : ${added} titre(s) ajouté(s), ${failed} échec(s).` +
      (DRY_RUN ? ' (dry-run, rien écrit)' : ''),
  )
  if (added > 0 && !DRY_RUN) console.log(`index.json : ${index.songs.length} titres au total.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
