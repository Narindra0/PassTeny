/**
 * Source de contenu Pass'Teny.
 *
 * - Développement (`CONTENT_LOCAL` ou NODE_ENV !== production) : lecture du
 *   dossier local `content/` (miroir du repo `pass-teny-content`).
 * - Production : lecture via `raw.githubusercontent.com` (CDN gratuit) —
 *   l'app ne clone jamais le repo content.
 *
 * Le contenu est indexé par `content/index.json` (généré par le seed).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/lib/config'
import type { Annotation, AnnotationsFile, ArtistSummary, Song, SongMeta, SongSummary } from '@/lib/types'

const CONTENT_DIR = path.join(process.cwd(), 'content')
const RAW_BASE = (repo: string, branch: string) =>
  `https://raw.githubusercontent.com/${repo}/${branch}`

// ── Cache mémoire (par requête) ─────────────────────────────────────────────
// Évite de relire tout le catalogue N fois quand listSongs, listAlbums et
// listArtists sont appelés plusieurs fois dans la même requête server.
// TTL court : 60s en dev, réinitialisé au démarrage du serveur.

const MEMORY_CACHE_TTL = 60_000 // 60 secondes
const memoryCache = new Map<string, { data: unknown; expiry: number }>()

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = memoryCache.get(key)
  if (hit && hit.expiry > now) return Promise.resolve(hit.data as T)
  return fn().then((data) => {
    memoryCache.set(key, { data, expiry: now + MEMORY_CACHE_TTL })
    return data
  })
}

// ── Utils ────────────────────────────────────────────────────────────────────

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

async function fetchRaw(repo: string, branch: string, filePath: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {}
    if (config.githubToken) {
      headers['Authorization'] = `Bearer ${config.githubToken}`
    }
    const res = await fetch(`${RAW_BASE(repo, branch)}/${filePath}`, {
      headers,
      // Sur Cloudflare Workers, next.revalidate est ignoré.
      // On laisse le header pour compatibilité locale/Vercel.
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      console.error(`[content] fetchRaw ${res.status}: ${filePath}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.error('[content] fetchRaw error:', filePath, err)
    return null
  }
}

async function fetchRawJson<T>(repo: string, branch: string, filePath: string): Promise<T | null> {
  const text = await fetchRaw(repo, branch, filePath)
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

// ── Index du contenu ─────────────────────────────────────────────────────────

interface ContentIndex {
  artists: { slug: string; name: string; coverUrl?: string }[]
  songs: { slug: string; artistSlug: string; artist: string; title: string; album: string; coverUrl?: string }[]
}

function isLocalMode(): boolean {
  return config.useLocalContent
}

async function getIndex(): Promise<ContentIndex | null> {
  return cached('index', async () => {
    if (isLocalMode()) {
      return readJson<ContentIndex>(path.join(CONTENT_DIR, 'index.json'))
    }
    return fetchRawJson<ContentIndex>(config.contentRepo, config.contentBranch, 'index.json')
  })
}

// ── Lectures des fichiers d'un titre ─────────────────────────────────────────

async function readSongFiles(
  artistSlug: string,
  songSlug: string,
): Promise<{ meta: SongMeta | null; lyrics: string | null; lrc: string | null; annotations: Annotation[] }> {
  if (isLocalMode()) {
    const dir = path.join(CONTENT_DIR, artistSlug, songSlug)
    const [meta, lyrics, lrc, annFile] = await Promise.all([
      readJson<SongMeta>(path.join(dir, 'meta.json')),
      readText(path.join(dir, 'lyrics.txt')),
      readText(path.join(dir, 'lyrics.lrc')),
      readJson<AnnotationsFile>(path.join(dir, 'annotations.json')),
    ])
    return { meta, lyrics, lrc, annotations: annFile?.annotations ?? [] }
  }

  const base = `${artistSlug}/${songSlug}`
  const [metaText, lyrics, lrc, annText] = await Promise.all([
    fetchRaw(config.contentRepo, config.contentBranch, `${base}/meta.json`),
    fetchRaw(config.contentRepo, config.contentBranch, `${base}/lyrics.txt`),
    fetchRaw(config.contentRepo, config.contentBranch, `${base}/lyrics.lrc`),
    fetchRaw(config.contentRepo, config.contentBranch, `${base}/annotations.json`),
  ])
  const meta = metaText ? (JSON.parse(metaText) as SongMeta) : null
  let annotations: Annotation[] = []
  if (annText) {
    try {
      annotations = (JSON.parse(annText) as AnnotationsFile).annotations ?? []
    } catch {
      annotations = []
    }
  }
  return { meta, lyrics, lrc, annotations }
}

// ── API publiques ────────────────────────────────────────────────────────────

export async function listArtists(): Promise<ArtistSummary[]> {
  return cached('listArtists', async () => {
    const index = await getIndex()
    if (!index) return []
    const counts = new Map<string, number>()
    for (const song of index.songs) {
      counts.set(song.artistSlug, (counts.get(song.artistSlug) ?? 0) + 1)
    }
    return index.artists.map((a) => ({
      slug: a.slug,
      name: a.name,
      coverUrl: a.coverUrl,
      songCount: counts.get(a.slug) ?? 0,
    }))
  })
}

export async function listSongs(): Promise<SongSummary[]> {
  return cached('listSongs', async () => {
    const index = await getIndex()
    if (!index) return []
    const summaries: SongSummary[] = []
    for (const song of index.songs) {
      const { meta, annotations } = await readSongFiles(song.artistSlug, song.slug)
      summaries.push({
        slug: song.slug,
        artistSlug: song.artistSlug,
        title: meta?.title || song.title,
        artist: meta?.artist || song.artist,
        album: meta?.album || song.album || '',
        coverUrl: meta?.coverUrl || song.coverUrl,
        releaseDate: meta?.releaseDate,
        annotationCount: annotations.length,
        language: meta?.language,
      })
    }
    return summaries
  })
}

export async function getArtist(artistSlug: string): Promise<ArtistSummary | null> {
  const artists = await listArtists()
  return artists.find((a) => a.slug === artistSlug) ?? null
}

export async function getArtistSongs(artistSlug: string): Promise<SongSummary[]> {
  const all = await listSongs()
  return all.filter((s) => s.artistSlug === artistSlug)
}

export async function getSong(slug: string): Promise<Song | null> {
  const index = await getIndex()
  if (!index) return null
  const entry = index.songs.find((s) => s.slug === slug)
  if (!entry) return null

  const { meta, lyrics, lrc, annotations } = await readSongFiles(entry.artistSlug, entry.slug)
  if (!meta || !lyrics) return null

  return {
    slug: entry.slug,
    artistSlug: entry.artistSlug,
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    coverUrl: meta.coverUrl,
    annotationCount: annotations.length,
    language: meta.language,
    meta,
    lyrics,
    lrc: lrc ?? undefined,
    annotations,
  }
}

// ── Albums (releases) ───────────────────────────────────────────────────────

/** Slug d'album déterministe : `artisteSlug--titre-slugifie`. */
export function albumSlug(artistSlug: string, album: string): string {
  const title = album
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${artistSlug}--${title || 'album'}`
}

/** Type de release déduit du nombre de titres (album / EP / single). */
export type ReleaseType = 'Album' | 'EP' | 'Single'

export function releaseType(trackCount: number): ReleaseType {
  if (trackCount === 1) return 'Single'
  if (trackCount <= 3) return 'EP'
  return 'Album'
}

/** Un album (release) du catalogue, avec sa tracklist. */
export interface Album {
  slug: string
  album: string
  artist: string
  artistSlug: string
  coverUrl?: string | null
  trackCount: number
  annotationCount: number
  /** Pistes dans l'ordre du catalogue (ordre de l'album). */
  tracks: SongSummary[]
  type: ReleaseType
}

/** Toutes les releases du catalogue, groupées par artiste + album. */
export async function listAlbums(): Promise<Album[]> {
  return cached('listAlbums', async () => {
    const songs = await listSongs()
    const groups = new Map<string, SongSummary[]>()
    for (const song of songs) {
      const key = `${song.artistSlug}__${song.album}`
      const list = groups.get(key) ?? []
      list.push(song)
      groups.set(key, list)
    }
    return [...groups.values()].map((tracks) => {
      const first = tracks[0]!
      return {
        slug: albumSlug(first.artistSlug, first.album),
        album: first.album,
        artist: first.artist,
        artistSlug: first.artistSlug,
        coverUrl: first.coverUrl,
        trackCount: tracks.length,
        annotationCount: tracks.reduce((n, s) => n + s.annotationCount, 0),
        tracks,
        type: releaseType(tracks.length),
      }
    })
  })
}

/** Les releases d'un artiste. */
export async function listArtistAlbums(artistSlug: string): Promise<Album[]> {
  const albums = await listAlbums()
  return albums.filter((a) => a.artistSlug === artistSlug)
}

/** Un album par son slug (`artisteSlug--titre-slugifie`). */
export async function getAlbum(slug: string): Promise<Album | null> {
  const albums = await listAlbums()
  return albums.find((a) => a.slug === slug) ?? null
}

/**
 * Classement des annotateurs — le « top » communautaire.
 * Agrège les auteurs d'annotations validées sur tout le catalogue,
 * trié par nombre de notes décroissant. Vide tant que le catalogue
 * n'a pas d'annotations (état d'invitation).
 */
export async function listAnnotators(limit = 8): Promise<{ author: string; count: number }[]> {
  const index = await getIndex()
  if (!index) return []
  const counts = new Map<string, number>()
  for (const song of index.songs) {
    const { annotations } = await readSongFiles(song.artistSlug, song.slug)
    for (const ann of annotations) {
      if (!ann.author) continue
      counts.set(ann.author, (counts.get(ann.author) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** Version canon (repo Git) du fichier annotations.json d'un titre. */
export async function getCanonicalAnnotations(artistSlug: string, songSlug: string): Promise<AnnotationsFile> {
  if (isLocalMode()) {
    const file = await readJson<AnnotationsFile>(
      path.join(CONTENT_DIR, artistSlug, songSlug, 'annotations.json'),
    )
    return file ?? { annotations: [] }
  }
  return (
    (await fetchRawJson<AnnotationsFile>(
      config.contentRepo,
      config.contentBranch,
      `${artistSlug}/${songSlug}/annotations.json`,
    )) ?? { annotations: [] }
  )
}
