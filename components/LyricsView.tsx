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

interface LyricsViewProps {
  lyrics: string
  annotations: Annotation[]
  songSlug: string
  onAnnotationSubmitted: () => void
}

interface RenderedLine {
  key: string
  text: string
  annotation: Annotation | null
  /** Offset de début de la ligne dans le canon (lyrics.txt). */
  start: number
}

export default function LyricsView({
  lyrics,
  annotations,
  songSlug,
  onAnnotationSubmitted,
}: LyricsViewProps) {
  const [selected, setSelected] = useState<Annotation | null>(null)
  const [pendingSel, setPendingSel] = useState<PendingSelection | null>(null)

  const lines = useMemo<RenderedLine[]>(() => {
    const segments = buildSegments(lyrics, annotations)
    const out: RenderedLine[] = []
    let offset = 0
    for (const seg of segments) {
      const pieces = seg.text.split('\n')
      pieces.forEach((piece, i) => {
        if (i > 0) {
          out.push({ key: `${seg.key}-br-${i}`, text: '', annotation: null, start: offset })
          offset += 1
        }
        if (piece) {
          out.push({ key: `${seg.key}-${i}`, text: piece, annotation: seg.annotation, start: offset })
          offset += piece.length
        }
      })
    }
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
      <div className="flex flex-col gap-1.5" onMouseUp={handleMouseUp}>
        {lines.map((line) =>
          line.text === '' ? (
            <div key={line.key} className="h-4" aria-hidden="true" />
          ) : line.annotation ? (
            <button
              key={line.key}
              type="button"
              data-lyric-line={line.start}
              onClick={() => setSelected(selected?.id === line.annotation!.id ? null : line.annotation)}
              className="w-fit rounded bg-amber-200/80 px-0.5 text-left transition-colors hover:bg-amber-300/80 dark:bg-amber-500/25 dark:hover:bg-amber-400/30"
              aria-label="Afficher l'annotation de ce passage"
            >
              {line.text}
            </button>
          ) : (
            <span key={line.key} data-lyric-line={line.start} className="leading-relaxed select-text">
              {line.text}
            </span>
          ),
        )}
      </div>

      {selected && (
        <aside className="sticky bottom-4 mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic text-zinc-600 dark:text-zinc-400">
              {selected.quote}
            </blockquote>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">{selected.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {selected.tags?.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                #{tag}
              </span>
            ))}
            {selected.author && (
              <span className="ml-auto font-medium text-zinc-600 dark:text-zinc-300">@{selected.author}</span>
            )}
          </div>
        </aside>
      )}

      {pendingSel && (
        <AnnotationComposer
          songSlug={songSlug}
          selection={pendingSel}
          onClose={() => setPendingSel(null)}
          onSubmitted={handleSubmitDone}
        />
      )}

    </div>
  )
}
