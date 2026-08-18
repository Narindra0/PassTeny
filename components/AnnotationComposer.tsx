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
    <div className="card fixed inset-x-0 bottom-0 z-40 m-4 rounded-2xl p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem] sm:m-0 sm:rounded-lg">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-ink">Annoter ce passage</h3>
          <blockquote className="mt-1 border-l-2 border-lamba-red pl-2 text-xs italic text-ink-soft">
            {selection.quote}
          </blockquote>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>

      {status === 'sent' ? (
        <p className="badge badge-soft-copper">
          <i className="fa-solid fa-circle-check" aria-hidden="true" />
          Annotation soumise — en attente de validation.
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
              className="input mt-1 font-normal normal-case tracking-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Tags (séparés par des virgules)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="amour, ohabolana"
              className="input mt-1 font-normal normal-case tracking-normal"
            />
          </label>
          {status === 'error' && <p className="text-xs font-medium text-red">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="btn btn-primary w-full"
          >
            {status === 'sending' ? 'Envoi…' : 'Soumettre'}
          </button>
        </form>
      )}
    </div>
  )
}
