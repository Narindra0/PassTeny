'use client'

/**
 * Composer d'annotation / punchline — apparaît après la sélection d'un passage.
 * Deux onglets : Annoter (explication + tags) ou Punchline (citer la ligne).
 */
import { useState } from 'react'
import { openSignIn } from '@/components/SignInModal'

export interface PendingSelection {
  start: number
  end: number
  quote: string
}

type Tab = 'annotate' | 'punchline'

interface AnnotationComposerProps {
  songSlug: string
  selection: PendingSelection
  onClose: () => void
  onSubmitted: () => void
}

export default function AnnotationComposer({ songSlug, selection, onClose, onSubmitted }: AnnotationComposerProps) {
  const [tab, setTab] = useState<Tab>('annotate')

  // ── Annotation state ──
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  // ── Punchline state ──
  const [punchContext, setPunchContext] = useState('')
  const [punchStatus, setPunchStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [punchError, setPunchError] = useState('')

  async function handleAnnotationSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length < 4) {
      setStatus('error')
      setError('L\'explication doit contenir au moins 4 caractères.')
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
      openSignIn()
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
    setTimeout(onClose, 900)
  }

  async function handlePunchlineSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPunchStatus('sending')
    setPunchError('')

    const res = await fetch('/api/punchlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songId: songSlug,
        quote: selection.quote,
        context: punchContext.trim() || undefined,
      }),
    })

    if (res.status === 401) {
      openSignIn()
      return
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPunchStatus('error')
      setPunchError(data.error || 'Une erreur est survenue.')
      return
    }

    setPunchStatus('sent')
    setPunchContext('')
    onSubmitted()
    setTimeout(onClose, 1500)
  }

  return (
    <div className="card fixed inset-x-0 bottom-0 z-40 m-4 overflow-hidden rounded-2xl shadow-card sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem] sm:m-0 sm:rounded-lg">
      {/* Header + citation */}
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 pt-4 pb-3">
        <div className="min-w-0">
          <blockquote className="max-h-12 overflow-hidden border-l-2 border-lamba-red pl-2 text-xs italic text-ink-soft">
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

      {/* Onglets */}
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => setTab('annotate')}
          className={`flex-1 py-2.5 text-center text-xs font-semibold uppercase tracking-wider transition-colors ${
            tab === 'annotate'
              ? 'border-b-2 border-red text-red'
              : 'text-ink-faint hover:text-ink'
          }`}
        >
          <i className="fa-solid fa-pen-nib mr-1.5" aria-hidden="true" />
          Annoter
        </button>
        <button
          type="button"
          onClick={() => setTab('punchline')}
          className={`flex-1 py-2.5 text-center text-xs font-semibold uppercase tracking-wider transition-colors ${
            tab === 'punchline'
              ? 'border-b-2 border-mustard text-mustard-dark'
              : 'text-ink-faint hover:text-ink'
          }`}
        >
          <i className="fa-solid fa-quote-left mr-1.5" aria-hidden="true" />
          Punchline
        </button>
      </div>

      {/* Corps */}
      <div className="px-4 py-4">
        {/* ══ Onglet Annotation ══ */}
        {tab === 'annotate' && (
          <>
            {status === 'sent' ? (
              <p className="py-2 text-center text-sm font-semibold text-green">
                <i className="fa-solid fa-circle-check mr-2" aria-hidden="true" />
                Annotation soumise !
              </p>
            ) : (
              <form onSubmit={handleAnnotationSubmit} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                  Explication
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    required
                    placeholder="Le sens, le contexte, la référence culturelle…"
                    className="input text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                  Tags
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="amour, ohabolana, métaphore"
                    className="input text-sm"
                  />
                </label>
                {status === 'error' && <p className="text-xs text-red">{error}</p>}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="btn btn-primary btn-sm w-full"
                >
                  {status === 'sending' ? (
                    <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Envoi…</>
                  ) : (
                    <><i className="fa-solid fa-pen-nib" aria-hidden="true" /> Soumettre l&apos;annotation</>
                  )}
                </button>
              </form>
            )}
          </>
        )}

        {/* ══ Onglet Punchline ══ */}
        {tab === 'punchline' && (
          <>
            {punchStatus === 'sent' ? (
              <div className="py-2 text-center">
                <i className="fa-solid fa-circle-check text-2xl text-green" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink">Punchline proposée !</p>
                <p className="mt-0.5 text-xs text-ink-soft">Elle apparaîtra après validation.</p>
              </div>
            ) : (
              <form onSubmit={handlePunchlineSubmit} className="flex flex-col gap-3">
                <p className="text-[11px] text-ink-faint">
                  Cette ligne sera mise en avant sur la page Punchlines.
                </p>
                <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                  Pourquoi c&apos;est marquant ? (optionnel)
                  <input
                    value={punchContext}
                    onChange={(e) => setPunchContext(e.target.value)}
                    placeholder="Le sens caché, la chute, la métaphore…"
                    className="input text-sm"
                  />
                </label>
                {punchStatus === 'error' && <p className="text-xs text-red">{punchError}</p>}
                <button
                  type="submit"
                  disabled={punchStatus === 'sending'}
                  className="btn btn-copper btn-sm w-full"
                >
                  {punchStatus === 'sending' ? (
                    <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Envoi…</>
                  ) : (
                    <><i className="fa-solid fa-quote-left" aria-hidden="true" /> Proposer comme punchline</>
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
