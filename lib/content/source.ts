/**
 * Source de contenu Pass'Teny.
 *
 * - Développement : lecture du dossier local `content/` (miroir du repo
 *   `pass-teny-content`), indexé via `content/index.json` généré par le seed.
 * - Production : lecture directe depuis le repo GitHub public
 *   (`raw.githubusercontent.com` + API GitHub), mise en cache par Next.js.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Annotation, AnnotationsFile, ArtistSummary, Song, SongMeta, SongSummary } from '@/lib/types'

const CONTENT_DIR = path.join(process.cwd(), 'content')

// ── Utils ────────────────────────────────────────────────────────────────────

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

// ── Index local (content/index.json) ─────────────────────────────────────────

interface ContentIndex {
  artists: { slug: string; name: string; coverUrl?: string }[]
  songs: { slug: string; artistSlug: string; artist: string; title: string; album: string; coverUrl?: string }[]
}

async function readLocalIndex(): Promise<ContentIndex | null> {
  return readJson<ContentIndex>(path.join(CONTENT_DIR, 'index.json'))
}

// ── API publiques ────────────────────────────────────────────────────────────

export async function listArtists(): Promise<ArtistSummary[]> {
  const index = await readLocalIndex()
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
  const index = await readLocalIndex()
  if (!index) return []
  const summaries: SongSummary[] = []
  for (const song of index.songs) {
    const meta = await readLocalMeta(song.artistSlug, song.slug)
    if (!meta) continue
    summaries.push(await toSummary(song.artistSlug, song.slug, meta, song))
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
  const index = await readLocalIndex()
  if (!index) return null
  const entry = index.songs.find((s) => s.slug === slug)
  if (!entry) return null

  const meta = await readLocalMeta(entry.artistSlug, entry.slug)
  if (!meta) return null

  const [lyrics, lrc, annotationsFile] = await Promise.all([
    readText(path.join(CONTENT_DIR, entry.artistSlug, entry.slug, 'lyrics.txt')),
    readText(path.join(CONTENT_DIR, entry.artistSlug, entry.slug, 'lyrics.lrc')),
    readJson<AnnotationsFile>(path.join(CONTENT_DIR, entry.artistSlug, entry.slug, 'annotations.json')),
  ])

  if (!lyrics) return null

  return {
    slug: entry.slug,
    artistSlug: entry.artistSlug,
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    coverUrl: meta.coverUrl,
    annotationCount: annotationsFile?.annotations?.length ?? 0,
    language: meta.language,
    meta,
    lyrics,
    lrc: lrc ?? undefined,
    annotations: (annotationsFile?.annotations ?? []) as Annotation[],
  }
}

// ── Helpers internes ─────────────────────────────────────────────────────────

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

async function readLocalMeta(artistSlug: string, songSlug: string): Promise<SongMeta | null> {
  return readJson<SongMeta>(path.join(CONTENT_DIR, artistSlug, songSlug, 'meta.json'))
}

async function toSummary(
  artistSlug: string,
  slug: string,
  meta: SongMeta,
  fallback?: { title: string; artist: string; album: string; coverUrl?: string },
): Promise<SongSummary> {
  const annotations = await readJson<AnnotationsFile>(
    path.join(CONTENT_DIR, artistSlug, slug, 'annotations.json'),
  )
  return {
    slug,
    artistSlug,
    title: meta.title || fallback?.title || slug,
    artist: meta.artist || fallback?.artist || slug,
    album: meta.album || fallback?.album || '',
    coverUrl: meta.coverUrl || fallback?.coverUrl,
    annotationCount: annotations?.annotations?.length ?? 0,
    language: meta.language,
  }
}
