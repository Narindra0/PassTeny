'use client'

/**
 * Rendu des lyrics avec annotations cliquables + création d'annotations
 * par sélection de texte (les offsets sont calculés depuis la position des
 * lignes dans `lyrics.txt` — le canon).
 */
import { useMemo, useState } from 'react'
import type { Annotation } from '@/lib/types'
import { buildSegments } from '@/lib/content/annotations'
import AnnotationComposer, { type PendingSelection } from './AnnotationComposer'
import SelectionVisual from './SelectionVisual'

interface LyricsViewProps {
  lyrics: string
  annotations: Annotation[]
  songSlug: string
  songTitle: string
  songArtist: string
  songCover?: string | null
  /** Session ouverte → le formulaire d'annotation est proposé. */
  canAnnotate: boolean
  onAnnotationSubmitted: () => void
}

interface RenderedPiece {
  key: string
  text: string
  annotation: Annotation | null
  /** Offset de début du morceau dans le canon (lyrics.txt). */
  start: number
}

interface RenderedLine {
  key: string
  /** Morceaux d'une même ligne physique — un passage annoté y est inline. */
  pieces: RenderedPiece[]
}

export default function LyricsView({
  lyrics,
  annotations,
  songSlug,
  songTitle,
  songArtist,
  songCover,
  canAnnotate,
  onAnnotationSubmitted,
}: LyricsViewProps) {
  const [selected, setSelected] = useState<Annotation | null>(null)
  const [pendingSel, setPendingSel] = useState<PendingSelection | null>(null)

  const lines = useMemo<RenderedLine[]>(() => {
    const segments = buildSegments(lyrics, annotations)
    const out: RenderedLine[] = []
    let current: RenderedPiece[] = []
    let offset = 0
    const flush = () => {
      out.push({ key: `line-${out.length}`, pieces: current })
      current = []
    }
    for (const seg of segments) {
      const pieces = seg.text.split('\n')
      pieces.forEach((piece, i) => {
        if (i > 0) {
          flush() // fin de ligne physique : on regroupe les morceaux précédents
          offset += 1
        }
        if (piece) {
          current.push({ key: `${seg.key}-${i}`, text: piece, annotation: seg.annotation, start: offset })
          offset += piece.length
        }
      })
    }
    flush()
    return out
  }, [lyrics, annotations])

  /** Calcule les offsets canon à partir de la sélection DOM. */
  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setPendingSel(null)
      return
    }
    const range = sel.getRangeAt(0)

    const lineOf = (node: Node): HTMLElement | null => {
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
      return el?.closest('[data-lyric-line]') ?? null
    }

    const startEl = lineOf(range.startContainer)
    const endEl = lineOf(range.endContainer)
    if (!startEl || !endEl) return

    const startBase = Number(startEl.dataset.lyricLine)
    const endBase = Number(endEl.dataset.lyricLine)
    const startOff =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startOffset
        : 0
    const endOff =
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endOffset
        : endEl.textContent?.length ?? 0

    let start = startBase + startOff
    let end = endBase + endOff
    if (start > end) [start, end] = [end, start]

    // Bornes + découpe des espaces.
    const text = lyrics
    start = Math.max(0, Math.min(start, text.length))
    end = Math.max(0, Math.min(end, text.length))
    while (start < end && /\s/.test(text[start]!)) start++
    while (end > start && /\s/.test(text[end - 1]!)) end--
    if (end - start < 2) {
      setPendingSel(null)
      return
    }
    setPendingSel({ start, end, quote: text.slice(start, end) })
  }

  function handleSubmitDone() {
    onAnnotationSubmitted()
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col gap-1" onMouseUp={handleMouseUp}>
        {lines.map((line) =>
          line.pieces.length === 0 ? (
            <div key={line.key} className="h-5" aria-hidden="true" />
          ) : (
            <div key={line.key} className="lyric-line text-ink">
              {line.pieces.map((piece) =>
                piece.annotation ? (
                  <button
                    key={piece.key}
                    type="button"
                    data-lyric-line={piece.start}
                    onClick={() => setSelected(selected?.id === piece.annotation!.id ? null : piece.annotation)}
                    className="rounded-[3px] bg-hl px-1 text-ink underline decoration-mustard-dark/60 decoration-2 underline-offset-[5px] transition-colors hover:bg-hl-strong hover:decoration-mustard-dark"
                    aria-label="Afficher l'annotation de ce passage"
                  >
                    {piece.text}
                  </button>
                ) : (
                  <span key={piece.key} data-lyric-line={piece.start} className="select-text">
                    {piece.text}
                  </span>
                ),
              )}
            </div>
          ),
        )}
      </div>

      {selected && (
        <aside className="card sticky bottom-4 mt-6 p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <blockquote className="border-l-[3px] border-mustard pl-3 font-display text-sm italic text-ink-soft">
              {selected.quote}
            </blockquote>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
              aria-label="Fermer"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink">{selected.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            {selected.tags?.map((tag) => (
              <span key={tag} className="rounded-full bg-hl px-2 py-0.5 text-mustard-dark">
                #{tag}
              </span>
            ))}
            {selected.author && (
              <a
                href={`/contributors/${encodeURIComponent(selected.author)}`}
                className="ml-auto font-medium text-ink-soft transition-colors hover:text-red hover:underline"
              >
                @{selected.author}
              </a>
            )}
          </div>
        </aside>
      )}

      {pendingSel &&
        (canAnnotate ? (
          <AnnotationComposer
            songSlug={songSlug}
            selection={pendingSel}
            onClose={() => setPendingSel(null)}
            onSubmitted={handleSubmitDone}
          />
        ) : (
          <SelectionVisual
            title={songTitle}
            artist={songArtist}
            quote={pendingSel.quote}
            cover={songCover}
            onClose={() => setPendingSel(null)}
          />
        ))}

    </div>
  )
}
