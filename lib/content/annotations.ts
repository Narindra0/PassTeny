/**
 * Moteur d'annotations — découpe le texte en segments annotés/non annotés,
 * valide les offsets et fusionne les soumissions (phase 1 : merges de PR).
 */
import type { Annotation } from '@/lib/types'

/** Segment prêt pour le rendu (partie du texte + annotation associée). */
export interface TextSegment {
  text: string
  annotation: Annotation | null
  key: string
}

/**
 * Découpe `text` en segments alternés, en appliquant les annotations
 * triées par offset. Les chevauchements sont résolus (la première
 * annotation qui démarre gagne, les suivantes sont clampées/décalées).
 */
export function buildSegments(text: string, annotations: Annotation[]): TextSegment[] {
  const sorted = [...annotations]
    .filter((a) => a.end > a.start && a.start < text.length)
    .sort((a, b) => a.start - b.start || b.end - a.end)

  if (sorted.length === 0) {
    return [{ text, annotation: null, key: 'raw-0' }]
  }

  const segments: TextSegment[] = []
  let cursor = 0
  let key = 0

  for (const ann of sorted) {
    const start = Math.max(ann.start, cursor)
    const end = Math.min(ann.end, text.length)

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), annotation: null, key: `raw-${key++}` })
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), annotation: ann, key: `ann-${ann.id}-${key++}` })
    }
    cursor = Math.max(cursor, end)
    if (cursor >= text.length) break
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), annotation: null, key: `raw-${key++}` })
  }

  return segments
}

/** Vérifie qu'une annotation est cohérente avec le texte (offsets + citation). */
export function validateAnnotation(
  annotation: Omit<Annotation, 'id' | 'author'>,
  text: string,
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  const { start, end, quote, body } = annotation

  if (typeof start !== 'number' || typeof end !== 'number') {
    reasons.push('offsets manquants')
  }
  if (start < 0 || end > text.length || end <= start) {
    reasons.push('offsets hors bornes')
  } else if (quote && text.slice(start, end) !== quote) {
    reasons.push('la citation ne correspond pas au texte sélectionné')
  }
  if (!body || body.trim().length < 4) {
    reasons.push('explication trop courte')
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons }
}

/**
 * Fusionne un lot de nouvelles annotations dans un fichier existant
 * (upsert par id). Utilisé par le pipeline PR (phase 1).
 */
export function mergeAnnotations(
  existing: Annotation[],
  incoming: Annotation[],
): { merged: Annotation[]; added: number; updated: number } {
  const byId = new Map(existing.map((a) => [a.id, a]))
  let added = 0
  let updated = 0

  for (const ann of incoming) {
    if (byId.has(ann.id)) {
      byId.set(ann.id, { ...byId.get(ann.id)!, ...ann, updatedAt: ann.updatedAt ?? new Date().toISOString() })
      updated++
    } else {
      byId.set(ann.id, ann)
      added++
    }
  }

  return { merged: [...byId.values()].sort((a, b) => a.start - b.start), added, updated }
}

/** Génère un id d'annotation court et stable (préfixe + hash). */
export function makeAnnotationId(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return `a_${hash.toString(36)}`
}
