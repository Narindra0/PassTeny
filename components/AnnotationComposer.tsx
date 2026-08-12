'use client'

/**
 * Composer d'annotation — apparaît après la sélection d'un passage.
 * Saisie de l'explication (obligatoire) et des tags (optionnels).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface PendingSelection {
  start: number
  end: number
  quote: string
}

interface AnnotationComposerProps {
  songSlug: string
  selection: PendingSelection
  onClose: () => void
  onSubmitted: () => void
}

export default function AnnotationComposer({ songSlug, selection, onClose, onSubmitted }: AnnotationComposerProps) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length < 4) {
      setStatus('error')
      setError('L’explication doit contenir au moins 4 caractères.')
      return
    }
    setStatus('sending')
    setError('')

    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song_id: songSlug,
        start_offset: selection.start,
        end_offset: selection.end,
        quote: selection.quote,
        body: body.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5),
      }),
    })

    if (res.status === 401) {
      router.push('/auth/signin')
      return
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus('error')
      setError(data.error || 'Une erreur est survenue.')
      return
    }

    setStatus('sent')
    setBody('')
    setTags('')
    onSubmitted()
    // Referme après un court délai pour laisser voir le succès.
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem] sm:rounded-2xl sm:border">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Annoter ce passage</h3>
          <blockquote className="mt-1 border-l-2 border-amber-400 pl-2 text-xs italic text-zinc-600 dark:text-zinc-400">
            {selection.quote}
          </blockquote>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {status === 'sent' ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          ✓ Annotation soumise — en attente de validation par la communauté.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Explication (sens, contexte, référence culturelle…)
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              required
              placeholder="Ex. : « Tia anao » — déclaration d’amour…"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal outline-none transition-colors focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Tags (séparés par des virgules)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="amour, ohabolana"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal outline-none transition-colors focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          {status === 'error' && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {status === 'sending' ? 'Envoi…' : 'Soumettre'}
          </button>
        </form>
      )}
    </div>
  )
}
