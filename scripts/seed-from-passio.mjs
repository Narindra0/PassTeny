#!/usr/bin/env node
/**
 * Pass'Teny — Seed initial depuis le catalogue Pass'io.
 *
 * Génère la structure du repo content (`content/`) à partir du dump de la
 * base Pass'io (backup Aiven) : un dossier par titre contenant
 * `meta.json`, `lyrics.lrc`, `lyrics.txt`, `annotations.json` (vide).
 *
 * Sources des lyrics (les .lrc du catalogue Pass'io) :
 *  - `api` (défaut) : récupère les paroles via l'API publique Pass'io
 *    pour les albums gratuits (aucune authentification requise).
 *  - `b2`           : télécharge depuis Backblaze B2 (nécessite les
 *    variables B2_* de `backend/.env`, ex.
 *    `node --env-file=../backend/.env scripts/seed-from-passio.mjs --source b2`).
 *  - `skip`         : métadonnées uniquement (fichiers lyrics laissés absents).
 *
 * Usage :
 *   node scripts/seed-from-passio.mjs                       # seed complet (API)
 *   node scripts/seed-from-passio.mjs --dry-run             # aperçu sans écrire
 *   node scripts/seed-from-passio.mjs --skip-lyrics         # méta uniquement
 *   node scripts/seed-from-passio.mjs --backup <fichier.json>
 *
 * Idempotent : les fichiers déjà présents sont conservés (reprise après crash).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name, def) => {
  const idx = args.indexOf(name)
  return idx >= 0 ? (args[idx + 1] ?? def) : def
}
const hasFlag = (name) => args.includes(name)

const BACKUP_PATH = flag(
  '--backup',
  path.resolve(process.cwd(), '../backend/backups/aiven-backup-2026-06-30T08-08-08-331Z.json'),
)
const OUT_DIR = path.resolve(process.cwd(), 'content')
let lyricsSource = flag('--source', hasFlag('--skip-lyrics') ? 'skip' : 'api')
const DRY_RUN = hasFlag('--dry-run')
const API_BASE = process.env.PASSIO_API_BASE || 'https://pass-io.onrender.com'
const CONCURRENCY = 5

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

async function fetchLyricsApi(track) {
  const url = `${API_BASE}/api/albums/tracks/${track.id}/lyrics`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'x-preview-mode': 'true' } })
      if (res.status === 200) return await res.text()
      if (res.status === 403 || res.status === 404) return null
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
  }
  return null
}

async function fetchLyricsB2(track, b2, bucket) {
  if (!b2 || !track.lyrics_storage_key) return null
  const response = await b2.client.send(
    new b2.GetObjectCommand({ Bucket: bucket, Key: track.lyrics_storage_key }),
  )
  const chunks = []
  for await (const chunk of response.Body) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function getB2Client() {
  if (!process.env.B2_ACCESS_KEY_ID || !process.env.B2_ENDPOINT) return null
  let sdk
  try {
    sdk = require('@aws-sdk/client-s3')
  } catch {
    throw new Error(
      'Mode B2 : @aws-sdk/client-s3 n\u2019est pas install\u00e9 dans PassTeny. ' +
        'Installez-le (npm i -D @aws-sdk/client-s3) ou utilisez la source API (d\u00e9faut).',
    )
  }
  return {
    client: new sdk.S3Client({
      region: process.env.B2_REGION || 'us-east-005',
      endpoint: process.env.B2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    }),
    GetObjectCommand: sdk.GetObjectCommand,
  }
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

// ── Chargement du dump ───────────────────────────────────────────────────────
async function loadDump() {
  const data = JSON.parse(await fs.readFile(BACKUP_PATH, 'utf8'))
  const tables = data.tables ?? {}
  const get = (name) => (Array.isArray(tables[name]) ? tables[name] : tables[name]?.data ?? [])
  const artists = get('artists')
  const albums = get('albums')
  const albumArtists = get('album_artists')
  const tracks = get('tracks')

  const artistById = new Map(artists.map((a) => [a.id, a]))
  const albumById = new Map(albums.map((a) => [a.id, a]))

  const artistsOfAlbum = new Map()
  for (const aa of albumArtists) {
    if (!artistsOfAlbum.has(aa.album_id)) artistsOfAlbum.set(aa.album_id, [])
    artistsOfAlbum.get(aa.album_id).push(aa)
  }

  return { artists, albums, tracks, artistById, albumById, artistsOfAlbum }
}

// ── Génération ───────────────────────────────────────────────────────────────
const usedArtistSlugs = new Set()

function buildArtistEntry(artist) {
  return {
    slug: dedupeSlug(slugify(artist.slug || artist.name) || 'artiste', usedArtistSlugs),
    name: artist.name,
    coverUrl: artist.profile_picture_url || null,
  }
}

function buildMeta(artist, album, track, artistsOfAlbum, albumById, artistById) {
  const memberArtists = (artistsOfAlbum.get(album.id) ?? [])
    .map((aa) => artistById.get(aa.artist_id))
    .filter(Boolean)
    .map((a) => a.name)
  const uniqueArtists = [...new Set(memberArtists.length > 0 ? memberArtists : [artist.name])]

  return {
    id: null, // rempli après déduction du slug
    title: track.title,
    artist: uniqueArtists[0],
    artists: uniqueArtists,
    album: album.title,
    albumSlug: album.slug || null,
    releaseDate: album.publication_date ? String(album.publication_date).slice(0, 10) : null,
    coverUrl: album.cover_url || null,
    language: [],
    tags: [],
    source: {
      platform: 'passio',
      albumId: album.id,
      trackId: track.id,
      albumTitle: album.title,
      note: 'Source : catalogue Pass\u2019io',
    },
    addedAt: new Date().toISOString().slice(0, 10),
  }
}

async function main() {
  const { artists, albums, tracks, artistById, albumById, artistsOfAlbum } = await loadDump()

  const withLyrics = tracks.filter((t) => t.lyrics_storage_key || t.has_lyrics)
  console.log(
    `Dump : ${artists.length} artistes, ${albums.length} albums, ${tracks.length} pistes, ${withLyrics.length} avec lyrics.`,
  )

  // Artistes concernés : ceux qui possèdent au moins un titre avec lyrics.
  const concernedIds = new Set()
  for (const track of withLyrics) {
    const album = albumById.get(track.album_id)
    if (album?.artist_id) concernedIds.add(album.artist_id)
  }
  const artistIndex = new Map()
  for (const artist of artists) {
    if (!concernedIds.has(artist.id)) continue
    artistIndex.set(artist.id, buildArtistEntry(artist))
  }

  // File des titres à générer (via l'artiste principal de l'album).
  const queue = []
  for (const track of withLyrics) {
    const album = albumById.get(track.album_id)
    if (!album) continue
    const artist = artistById.get(album.artist_id)
    const artistEntry = artistIndex.get(album.artist_id)
    if (!artist || !artistEntry) continue
    queue.push({ track, album, artist, artistEntry })
  }

  const perArtistSlugs = new Map()
  for (const item of queue) {
    if (!perArtistSlugs.has(item.artistEntry.slug)) perArtistSlugs.set(item.artistEntry.slug, new Set())
    item.songSlug = dedupeSlug(slugify(item.track.title) || 'titre', perArtistSlugs.get(item.artistEntry.slug))
  }

  console.log(`Contenu à générer : ${queue.length} titres (${artistIndex.size} artistes).`)

  let b2Client = null
  if (lyricsSource === 'b2') {
    b2Client = await getB2Client()
    if (!b2Client) {
      console.warn('⚠ Variables B2_* absentes : bascule sur la source API.')
      lyricsSource = 'api'
    }
  }

  let ok = 0
  let skipped = 0
  let noLyrics = 0

  const run = async (item) => {
    const meta = buildMeta(item.artist, item.album, item.track, artistsOfAlbum, albumById, artistById)
    const dir = path.join(OUT_DIR, item.artistEntry.slug, item.songSlug)

    const existingLrc = await fs.readFile(path.join(dir, 'lyrics.lrc'), 'utf8').catch(() => null)
    const existingMeta = await fs.readFile(path.join(dir, 'meta.json'), 'utf8').catch(() => null)

    if (existingMeta && (existingLrc || lyricsSource === 'skip')) {
      skipped++
      return
    }

    let lrc = existingLrc
    if (!lrc && lyricsSource !== 'skip') {
      lrc =
        lyricsSource === 'b2'
          ? await fetchLyricsB2(item.track, b2Client, process.env.B2_BUCKET_NAME)
          : await fetchLyricsApi(item.track)
    }


    if (DRY_RUN) {
      console.log(`  [dry-run] ${item.artist.name} — ${item.track.title} (lyrics: ${lrc ? 'ok' : 'absent'})`)
      return
    }

    meta.id = item.songSlug
    await fs.mkdir(dir, { recursive: true })
    const tasks = [
      fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n'),
      fs.writeFile(path.join(dir, 'annotations.json'), JSON.stringify({ annotations: [] }, null, 2) + '\n'),
    ]
    if (lrc) {
      tasks.push(
        fs.writeFile(path.join(dir, 'lyrics.lrc'), lrc),
        fs.writeFile(path.join(dir, 'lyrics.txt'), lrcToPlainText(lrc) + '\n'),
      )
    }
    await Promise.all(tasks)

    if (lrc) ok++
    else {
      noLyrics++
      console.warn(`  ⚠ ${item.artist.name} — « ${item.track.title} » : lyrics non récupérés (meta seule).`)
    }
  }

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(run))
  }

  if (!DRY_RUN) {
    const index = {
      generatedAt: new Date().toISOString(),
      source: 'catalogue Pass\u2019io (seed initial)',
      artists: [...artistIndex.values()],
      songs: queue.map((item) => ({
        slug: item.songSlug,
        artistSlug: item.artistEntry.slug,
        artist: item.artist.name,
        title: item.track.title,
        album: item.album.title,
        coverUrl: item.album.cover_url || null,
      })),
    }
    await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  }

  console.log(
    `\nTerminé : ${ok} titres avec lyrics, ${noLyrics} sans lyrics (meta seule), ${skipped} déjà présents.` +
      (DRY_RUN ? ' (dry-run, rien écrit)' : ''),
  )
  if (!DRY_RUN) console.log(`Output : ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
