/**
 * Client du catalogue Pass'io (API publique, `x-preview-mode`).
 *
 * Endpoints découverts (le seed les utilise aussi) :
 *   GET /api/albums                        → liste des albums (avec artiste)
 *   GET /api/albums/{id}                   → détail album + tracklist embarquée
 *   GET /api/albums/tracks/{id}/lyrics     → paroles au format LRC
 *
 * Tous les accès sont faits côté serveur (pas de CORS, header d'aperçu).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const API_BASE = process.env.PASSIO_API_BASE || 'https://pass-io.onrender.com'
const PREVIEW_HEADER = { 'x-preview-mode': 'true' } as const

export interface PassioAlbum {
  id: string
  title: string
  artist_id: string | null
  artist_name: string | null
  artists: { id: string; name: string }[] | null
  cover_url: string | null
  type: string | null
  publication_date: string | null
  is_free: boolean
}

export interface PassioTrack {
  id: string
  title: string
  position: number
  has_lyrics: boolean
  lyrics_url: string | null
  duration: number | null
}

export interface PassioAlbumDetail extends PassioAlbum {
  tracks: PassioTrack[]
}

/** Cache mémoire court (5 min) pour ne pas marteler l'API Pass'io. */
const cache = new Map<string, { at: number; data: unknown }>()
const CACHE_TTL = 5 * 60_000

async function fetchPassio<T>(path: string, ttl = CACHE_TTL): Promise<T | null> {
  const cached = cache.get(path)
  if (cached && Date.now() - cached.at < ttl) return cached.data as T

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { ...PREVIEW_HEADER, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as T
    cache.set(path, { at: Date.now(), data })
    return data
  } catch (err) {
    console.error('[passio]', path, err)
    return null
  }
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

/** Tous les albums du catalogue Pass'io. */
export async function listPassioAlbums(): Promise<PassioAlbum[]> {
  return (await fetchPassio<PassioAlbum[]>('/api/albums')) ?? []
}

/**
 * Score d'un texte sur un terme de requête : égalité > préfixe > inclusion.
 * 0 = pas de correspondance.
 */
function termScore(text: string, term: string): number {
  if (!text.includes(term)) return 0
  if (text === term) return 4
  if (text.startsWith(term)) return 3
  return 2
}

/**
 * Recherche multi-termes : chaque mot de la requête matche indépendamment
 * (titre OU artiste), puis on additionne les scores. « bro balz » → « bro »
 * matche le titre « Bro ft. Mendev » et « balz » l'artiste — gros bonus si
 * tous les termes sont trouvés. Insensible aux accents.
 */
function scoreMultiTerm(
  fields: { title: string; artist: string; members: string[] },
  terms: string[],
): number {
  let score = 0
  let matched = 0
  for (const term of terms) {
    let best = 0
    best = Math.max(best, termScore(fields.title, term))
    best = Math.max(best, termScore(fields.artist, term))
    for (const member of fields.members) {
      best = Math.max(best, termScore(member, term))
    }
    if (best > 0) {
      score += best
      matched++
    }
  }
  // Tous les termes trouvés (ex. titre + artiste) → forte préférence.
  if (matched > 0 && matched === terms.length) score += 8
  return score
}

/**
 * Recherche d'albums dans le catalogue Pass'io (titre/artiste, insensible
 * aux accents, multi-termes). Retourne les albums correspondants, classés.
 */
export async function searchPassioCatalog(rawQuery: string, limit = 10): Promise<PassioAlbum[]> {
  const terms = normalize(rawQuery.trim()).split(' ').filter(Boolean)
  if (terms.length === 0) return []

  const albums = await listPassioAlbums()
  const scored: { album: PassioAlbum; score: number }[] = []

  for (const album of albums) {
    const score = scoreMultiTerm(
      {
        title: normalize(album.title),
        artist: normalize(album.artist_name ?? ''),
        members: (album.artists ?? []).map((a) => normalize(a.name)),
      },
      terms,
    )
    if (score > 0) scored.push({ album, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.album)
}

/** Détail d'un album Pass'io (avec sa tracklist). */
export async function getPassioAlbum(albumId: string): Promise<PassioAlbumDetail | null> {
  if (!/^[a-f0-9-]{36}$/i.test(albumId)) return null
  return fetchPassio<PassioAlbumDetail>(`/api/albums/${albumId}`)
}

/** Paroles LRC d'un titre Pass'io (null si absentes / non libres). */
export async function getPassioTrackLyrics(trackId: string): Promise<string | null> {
  if (!/^[a-f0-9-]{36}$/i.test(trackId)) return null
  try {
    const res = await fetch(`${API_BASE}/api/albums/tracks/${trackId}/lyrics`, {
      headers: { ...PREVIEW_HEADER },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

// ── Index des pistes (recherche directe, sans passer par l'album) ───────────

/** Une piste du catalogue, avec le contexte de son album. */
export interface PassioTrackHit {
  id: string
  title: string
  artistName: string
  albumTitle: string
  albumId: string
  coverUrl: string | null
  hasLyrics: boolean
}

const INDEX_TTL = 6 * 60 * 60_000 // 6 h en mémoire
const INDEX_CACHE_FILE = path.join(process.cwd(), '.cache', 'passio-track-index.json')
let indexBuild: Promise<PassioTrackHit[]> | null = null

/**
 * Index complet des pistes Pass'io (albums → tracklists).
 *
 * La construction coûte ~16 s (280 albums, 630 pistes) : on la fait au plus
 * une fois — le résultat est **persisté sur disque** (`.cache/`) et servi
 * instantanément aux redémarrages suivants (dev, déploiement).
 *
 * Stale-while-revalidate : un index récent est servi immédiatement pendant
 * qu'un rafraîchissement tourne en arrière-plan. Un échec de construction ne
 * remplace jamais un bon index (pas de « recherche vide » pendant 6 h).
 */
export async function getPassioTrackIndex(): Promise<PassioTrackHit[]> {
  // Index récent en mémoire → servi tel quel.
  const cached = cache.get('__track_index__')
  if (cached && Date.now() - cached.at < INDEX_TTL) return cached.data as PassioTrackHit[]

  // Index récent sur disque → servi, rafraîchi en arrière-plan.
  const diskHits = await getDiskIndex()
  if (diskHits.length > 0) {
    void rebuildTrackIndex() // non bloquant
    return diskHits
  }

  // Rien en cache (première fois) → construction synchrone.
  return rebuildTrackIndex()
}

let diskIndexLoaded = false
let diskIndex: PassioTrackHit[] = []
let diskIndexLoad: Promise<PassioTrackHit[]> | null = null

/** Charge l'index persistant une seule fois (paresseux). */
function getDiskIndex(): Promise<PassioTrackHit[]> {
  if (diskIndexLoaded) return Promise.resolve(diskIndex)
  if (!diskIndexLoad) {
    diskIndexLoad = (async () => {
      try {
        const raw = await fs.readFile(INDEX_CACHE_FILE, 'utf8')
        const parsed = JSON.parse(raw)
        diskIndex = Array.isArray(parsed) ? (parsed as PassioTrackHit[]) : []
      } catch {
        diskIndex = []
      }
      diskIndexLoaded = true
      return diskIndex
    })()
  }
  return diskIndexLoad
}

/** Construit l'index s'il n'est pas déjà en cours, puis le cache (mémoire + disque). */
async function rebuildTrackIndex(): Promise<PassioTrackHit[]> {
  if (indexBuild) return indexBuild
  indexBuild = buildTrackIndex().finally(() => {
    indexBuild = null
  })
  const hits = await indexBuild

  // On ne cache que les constructions utiles : un catalogue vide (API injoignable)
  // n'est jamais mis en cache — la prochaine recherche réessaiera.
  if (hits.length > 0) {
    cache.set('__track_index__', { at: Date.now(), data: hits })
    void saveDiskIndex(hits)
  }
  return hits
}

async function saveDiskIndex(hits: PassioTrackHit[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(INDEX_CACHE_FILE), { recursive: true })
    await fs.writeFile(INDEX_CACHE_FILE, JSON.stringify(hits), 'utf8')
  } catch {
    // Cache disque optionnel : un échec n'est pas bloquant.
  }
}

async function buildTrackIndex(): Promise<PassioTrackHit[]> {
  const albums = await listPassioAlbums()
  const hits: PassioTrackHit[] = []
  const CONCURRENCY = 20

  for (let i = 0; i < albums.length; i += CONCURRENCY) {
    const batch = albums.slice(i, i + CONCURRENCY)
    const details = await Promise.all(
      batch.map(async (album) => {
        const detail = await getPassioAlbum(album.id)
        return detail ? { album, tracks: detail.tracks ?? [] } : null
      }),
    )

    // Un lot entièrement en échec = API injoignable : on s'arrête là au lieu
    // d'enchaîner 14 × 20 s de timeouts (le cache existant, s'il y en a un,
    // n'est pas remplacé).
    if (details.every((d) => d === null)) break

    for (const d of details) {
      if (!d) continue
      for (const t of d.tracks) {
        hits.push({
          id: t.id,
          title: t.title,
          artistName: d.album.artist_name ?? 'Artiste inconnu',
          albumTitle: d.album.title,
          albumId: d.album.id,
          coverUrl: d.album.cover_url,
          hasLyrics: t.has_lyrics,
        })
      }
    }
  }
  return hits
}

/**
 * Lance la construction de l'index en arrière-plan (pré-chauffage) :
 * l'utilisateur peut commencer à taper pendant que le catalogue se charge.
 */
export function warmPassioTrackIndex(): void {
  void getPassioTrackIndex().catch(() => {})
}

/**
 * Recherche directe de pistes (titre, artiste — insensible aux accents,
 * multi-termes, classée par pertinence). Ne passe plus par l'album.
 * Ex. « bro balz » → titre « Bro ft. Mendev » + artiste « BALZ. ».
 */
export async function searchPassioTracks(rawQuery: string, limit = 12): Promise<PassioTrackHit[]> {
  const terms = normalize(rawQuery.trim()).split(' ').filter(Boolean)
  if (terms.length === 0) return []

  const index = await getPassioTrackIndex()
  const scored: { hit: PassioTrackHit; score: number }[] = []

  for (const hit of index) {
    const score = scoreMultiTerm(
      {
        title: normalize(hit.title),
        artist: normalize(hit.artistName),
        members: [],
      },
      terms,
    )
    if (score > 0) scored.push({ hit, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.hit)
}
