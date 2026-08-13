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
    const res = await fetch(`${RAW_BASE(repo, branch)}/${filePath}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
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
  if (isLocalMode()) {
    return readJson<ContentIndex>(path.join(CONTENT_DIR, 'index.json'))
  }
  return fetchRawJson<ContentIndex>(config.contentRepo, config.contentBranch, 'index.json')
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
}

export async function listSongs(): Promise<SongSummary[]> {
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
