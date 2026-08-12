'use client'

/**
 * Rendu des lyrics avec annotations cliquables.
 * Les passages annotés sont surlignés ; un clic ouvre le détail
 * (explication, tags, auteur). Design neutre pour l'instant —
 * l'identité visuelle sera définie dans une étape dédiée.
 */
import { useMemo, useState } from 'react'
import type { Annotation } from '@/lib/types'
import { buildSegments } from '@/lib/content/annotations'

interface LyricsViewProps {
  lyrics: string
  annotations: Annotation[]
}

export default function LyricsView({ lyrics, annotations }: LyricsViewProps) {
  const [selected, setSelected] = useState<Annotation | null>(null)
  const segments = useMemo(() => buildSegments(lyrics, annotations), [lyrics, annotations])

  const lines = useMemo(() => {
    return segments.reduce<{ text: string; annotation: Annotation | null; key: string }[]>(
      (acc, seg) => {
        const pieces = seg.text.split('\n')
        pieces.forEach((piece, i) => {
          if (i > 0) acc.push({ text: '', annotation: null, key: `${seg.key}-br-${i}` })
          if (piece) acc.push({ text: piece, annotation: seg.annotation, key: `${seg.key}-${i}` })
        })
        return acc
      },
      [],
    )
  }, [segments])

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col gap-1.5">
        {lines.map((line) =>
          line.text === '' ? (
            <div key={line.key} className="h-4" aria-hidden="true" />
          ) : line.annotation ? (
            <button
              key={line.key}
              type="button"
              onClick={() => setSelected(selected?.id === line.annotation!.id ? null : line.annotation)}
              className="w-fit rounded bg-amber-200/80 px-0.5 text-left transition-colors hover:bg-amber-300/80 dark:bg-amber-500/25 dark:hover:bg-amber-400/30"
              aria-label="Afficher l'annotation de ce passage"
            >
              {line.text}
            </button>
          ) : (
            <span key={line.key} className="leading-relaxed">
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
            {selected.author && <span className="ml-auto font-medium text-zinc-600 dark:text-zinc-300">@{selected.author}</span>}
          </div>
        </aside>
      )}
    </div>
  )
}
