/**
 * Recherche dans le catalogue.
 *
 * Stratégie à trois niveaux, du plus pertinent au plus robuste :
 *
 * 1. **RPC `search_songs`** (schema.sql) — full-text Postgres `ts_rank` sur
 *    l'index `search` (construit avec `unaccent`) : insensible aux accents,
 *    mots entiers, classement par pertinence. Utilisée dès qu'elle est
 *    appliquée au projet Supabase (sinon PGRST202 → on continue).
 * 2. **Recherche locale (dev)** — normalisation app (minuscules + accents
 *    retirés) sur titre / artiste / album / paroles : fonctionne partout,
 *    sans migration, avec classement (titre > artiste > album > paroles).
 * 3. **Repli ILIKE multi-champs (prod sans RPC)** — le comportement V1.
 */
import { config } from '@/lib/config'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getSong, listAlbums, listArtists, listSongs, type Album } from '@/lib/content/source'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export interface SearchResult {
  slug: string
  artistSlug: string
  artist: string
  title: string
  album: string | null
  /** Extrait des paroles (segments surlignés) si le match vient des lyrics. */
  snippet?: SnippetSegment[] | null
}

export interface SnippetSegment {
  text: string
  hit: boolean
}

export interface ArtistSearchResult {
  slug: string
  name: string
  songCount: number
  coverUrl?: string | null
}

export interface AlbumSearchResult {
  slug: string
  title: string
  artist: string
  artistSlug: string
  coverUrl?: string | null
  trackCount: number
  annotationCount: number
  type: string
}

interface SearchRow {
  id: string
  artist_slug: string
  artist_name: string
  title: string
  album: string | null
}

/** Normalise un texte : minuscules, accents retirés, ponctuation → espaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toResult(row: SearchRow): SearchResult {
  return {
    slug: row.id,
    artistSlug: row.artist_slug,
    artist: row.artist_name,
    title: row.title,
    album: row.album,
    snippet: null,
  }
}

/**
 * Construit un extrait de paroles autour de la première ligne qui matche un
 * terme (1 ligne de contexte avant/après), avec les occurrences marquées.
 */
function buildSnippet(lyrics: string, terms: string[]): SnippetSegment[] | null {
  const lines = lyrics.split(/\r?\n/)
  let hitLine = -1
  for (let i = 0; i < lines.length; i++) {
    const n = normalize(lines[i])
    if (terms.some((t) => n.includes(t))) {
      hitLine = i
      break
    }
  }
  if (hitLine === -1) return null
  const start = Math.max(0, hitLine - 1)
  const end = Math.min(lines.length - 1, hitLine + 1)
  return markSegments(lines.slice(start, end + 1).join(' '), terms)
}

/**
 * Découpe un texte en segments en marquant les occurrences des termes,
 * insensible à la casse et aux accents (via le même `normalize` que la recherche).
 */
function markSegments(text: string, terms: string[]): SnippetSegment[] {
  // Texte normalisé + correspondance index normalisé → index original.
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const de = text[i]!
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (/[a-z0-9]/.test(de)) {
      map.push(i)
      norm += de
    } else if (/\s/.test(de)) {
      if (!norm.endsWith(' ')) {
        map.push(i)
        norm += ' '
      }
    }
  }

  const ranges: { start: number; end: number }[] = []
  for (const t of terms) {
    if (!t) continue
    let idx = norm.indexOf(t)
    while (idx !== -1) {
      ranges.push({ start: map[idx]!, end: map[idx + t.length - 1]! + 1 })
      idx = norm.indexOf(t, idx + t.length)
    }
  }

  if (ranges.length === 0) return [{ text, hit: false }]
  ranges.sort((a, b) => a.start - b.start)

  // Fusionne les occurrences chevauchantes.
  const merged: { start: number; end: number }[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }

  const segments: SnippetSegment[] = []
  let cursor = 0
  for (const r of merged) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start), hit: false })
    segments.push({ text: text.slice(r.start, r.end), hit: true })
    cursor = r.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments
}

export async function searchSongs(rawQuery: string, limit = 20): Promise<SearchResult[]> {
  const q = rawQuery.trim()
  if (!q) return []

  // ── 1) RPC full-text (unaccent + ts_rank) — via REST direct, sans typage
  //       supabase-js (la fonction n'existe pas encore dans database.types). ──
  const rpcResults = await rpcSearchSongs(q, limit)
  if (rpcResults.length > 0) {
    // Le full-text RPC matche aussi dans les paroles (tsvector concaténé) :
    // on enrichit les résultats dont le match ne vient pas d'un champ du titre.
    return attachSnippets(rpcResults, q)
  }

  // ── 2) Recherche locale normalisée (dev) — accents insensibles + paroles ──
  if (config.useLocalContent) {
    return searchLocal(q, limit)
  }

  // ── 3) Repli prod sans RPC : ILIKE multi-champs ──
  const supabase = getSupabaseServer()
  if (supabase) return searchIlike(supabase, q, limit)
  return []
}

/**
 * Ajoute un extrait de paroles aux résultats dont le match ne vient pas d'un
 * champ du titre (titre / artiste / album) mais des lyrics — avec surlignage
 * des termes trouvés dans les paroles.
 */
async function attachSnippets(results: SearchResult[], rawQuery: string): Promise<SearchResult[]> {
  const nq = normalize(rawQuery.trim())
  if (!nq) return results
  const terms = nq.split(' ')
  const out: SearchResult[] = []
  for (const r of results) {
    let snippet: SnippetSegment[] | null = null
    const title = normalize(r.title)
    const artist = normalize(r.artist)
    const album = normalize(r.album ?? '')
    const fieldMatch = title.includes(nq) || artist.includes(nq) || album.includes(nq)
    if (!fieldMatch) {
      const full = await getSong(r.slug)
      if (full) snippet = buildSnippet(full.lyrics, terms)
    }
    out.push({ ...r, snippet })
  }
  return out
}

/** Appelle la RPC `search_songs` si elle existe (PGRST202 → []). */
async function rpcSearchSongs(q: string, limit: number): Promise<SearchResult[]> {
  const { url, anonKey } = config.supabase
  if (!url || !anonKey) return []
  try {
    const res = await fetch(`${url}/rest/v1/rpc/search_songs`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: q, max_results: limit }),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as SearchRow[]
    return data.map(toResult)
  } catch {
    return []
  }
}

/** Recherche locale sur le contenu : normalisée, classée, paroles incluses. */
async function searchLocal(q: string, limit: number): Promise<SearchResult[]> {
  const nq = normalize(q)
  if (!nq) return []
  const terms = nq.split(' ')
  const songs = await listSongs()

  const scored: {
    slug: string
    artistSlug: string
    artist: string
    title: string
    album: string
    score: number
    snippet: SnippetSegment[] | null
  }[] = []

  for (const song of songs) {
    const title = normalize(song.title)
    const artist = normalize(song.artist)
    const album = normalize(song.album)

    let score = 0
    let snippet: SnippetSegment[] | null = null
    if (title === nq) score = 1000
    else if (title.startsWith(nq)) score = 900
    else if (title.includes(nq)) score = 800
    else if (artist === nq) score = 700
    else if (artist.startsWith(nq)) score = 650
    else if (artist.includes(nq)) score = 600
    else if (album.includes(nq)) score = 500

    // Paroles : un extrait libre de lyrics — tous les termes présents.
    if (score === 0) {
      const full = await getSong(song.slug)
      if (full && terms.every((t) => normalize(full.lyrics).includes(t))) {
        score = 400
        snippet = buildSnippet(full.lyrics, terms)
      }
    }

    if (score > 0)
      scored.push({
        slug: song.slug,
        artistSlug: song.artistSlug,
        artist: song.artist,
        title: song.title,
        album: song.album,
        score,
        snippet,
      })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ slug, artistSlug, artist, title, album, snippet }) => ({
    slug,
    artistSlug,
    artist,
    title,
    album,
    snippet,
  }))
}

/** Albums dont le titre ou l'artiste correspond (normalisé, accents insensibles). */
export async function searchAlbums(rawQuery: string, limit = 12): Promise<AlbumSearchResult[]> {
  const q = normalize(rawQuery.trim())
  if (!q) return []
  const terms = q.split(' ')
  const albums = await listAlbums()

  const scored: { a: Album; score: number }[] = []
  for (const a of albums) {
    const title = normalize(a.album)
    const artist = normalize(a.artist)
    let score = 0
    if (title === q) score = 200
    else if (title.startsWith(q)) score = 180
    else if (title.includes(q)) score = 160
    else if (artist === q) score = 120
    else if (artist.includes(q)) score = 100
    else if (terms.length > 1 && terms.every((t) => title.includes(t) || artist.includes(t))) score = 90

    if (score > 0) scored.push({ a, score })
  }

  scored.sort((x, y) => y.score - x.score)
  return scored.slice(0, limit).map(({ a }) => ({
    slug: a.slug,
    title: a.album,
    artist: a.artist,
    artistSlug: a.artistSlug,
    coverUrl: a.coverUrl,
    trackCount: a.trackCount,
    annotationCount: a.annotationCount,
    type: a.type,
  }))
}

/** Artistes dont le nom correspond (normalisé, accents insensibles). */
export async function searchArtists(rawQuery: string, limit = 4): Promise<ArtistSearchResult[]> {
  const q = normalize(rawQuery.trim())
  if (!q) return []
  const artists = await listArtists()

  const scored: { slug: string; name: string; songCount: number; coverUrl?: string | null; score: number }[] = []
  for (const a of artists) {
    const name = normalize(a.name)
    let score = 0
    if (name === q) score = 100
    else if (name.startsWith(q)) score = 90
    else if (name.includes(q)) score = 80
    if (score > 0)
      scored.push({ slug: a.slug, name: a.name, songCount: a.songCount, coverUrl: a.coverUrl, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ slug, name, songCount, coverUrl }) => ({
    slug,
    name,
    songCount,
    coverUrl,
  }))
}

/** Repli V1 : ILIKE multi-champs (titre, artiste, paroles) via PostgREST. */
async function searchIlike(supabase: SupabaseClient<Database>, q: string, limit: number): Promise<SearchResult[]> {
  // Assainit l'entrée : lettres/chiffres/espaces (accents inclus), ce qui
  // protège la grammaire or() de PostgREST et neutralise les wildcards ILIKE.
  const safe = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!safe) return []

  const { data, error } = await supabase
    .from('songs')
    .select('id, artist_slug, artist_name, title, album')
    .or(`title.ilike.%${safe}%,artist_name.ilike.%${safe}%,lyrics_txt.ilike.%${safe}%`)
    .order('artist_name')
    .limit(limit)

  if (error) {
    console.error('[search]', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    slug: row.id,
    artistSlug: row.artist_slug,
    artist: row.artist_name,
    title: row.title,
    album: row.album,
  }))
}
