/**
 * Parser LRC — fichiers de paroles synchronisées utilisés par Pass'io
 * et réutilisés par Pass'Teny (format canon du repo content).
 *
 * Format accepté : `[mm:ss.xx]` ou `[mm:ss.xxx]`, éventuellement précédés
 * de balises métadonnées `[ti:]`, `[ar:]`, `[al:]`, `[by:]`, `[offset:]`.
 */

export interface LrcLine {
  /** Timestamp en millisecondes (null pour les lignes sans timestamp). */
  time: number | null
  text: string
}

const TIME_TAG_RE = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const META_TAG_RE = /^\[(ti|ar|al|by|offset|re|ve|length):(.*?)\]\s*$/i
const KNOWN_META = new Set(['ti', 'ar', 'al', 'by', 'offset', 're', 've', 'length'])

function parseTime(minutes: string, seconds: string, fraction?: string): number {
  const min = Number(minutes)
  const sec = Number(seconds)
  const frac = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) : 0
  return min * 60_000 + sec * 1000 + frac
}

/**
 * Parse un contenu LRC en lignes ordonnées par timestamp.
 */
export function parseLrc(lrc: string): LrcLine[] {
  const lines = lrc.replace(/^\uFEFF/, '').split(/\r?\n/)
  const result: LrcLine[] = []

  for (const raw of lines) {
    const meta = META_TAG_RE.exec(raw)
    if (meta && KNOWN_META.has(meta[1].toLowerCase())) continue // balise métadonnée

    const timeTags = [...raw.matchAll(TIME_TAG_RE)]
    if (timeTags.length === 0) {
      const text = raw.trim()
      if (text) result.push({ time: null, text })
      continue
    }

    const text = raw.replace(TIME_TAG_RE, '').trim()
    if (!text) continue
    for (const m of timeTags) {
      result.push({ time: parseTime(m[1], m[2], m[3]), text })
    }
  }

  return result.sort((a, b) => (a.time ?? -1) - (b.time ?? -1))
}

/**
 * Convertit un LRC en paroles brutes (une ligne = un vers).
 * Les lignes dupliquées (karaoké mot-à-mot) sont fusionnées.
 */
export function lrcToPlainText(lrc: string): string {
  const seen = new Set<string>()
  const lines: string[] = []

  for (const line of parseLrc(lrc)) {
    const normalized = line.text.trim()
    if (!normalized) continue
    // Fusion des répétitions (ex. rendu mot-à-mot d'une même ligne).
    if (seen.has(normalized)) continue
    seen.add(normalized)
    lines.push(normalized)
  }

  return lines.join('\n')
}
