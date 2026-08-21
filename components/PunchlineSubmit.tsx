'use client'

/**
 * Bouton + formulaire pour proposer une punchline depuis une page titre.
 * Apparaît en floating button, ouvre un panneau de saisie.
 */
import { useState } from 'react'
import { openSignIn } from '@/components/SignInModal'

interface PunchlineSubmitProps {
  songId: string
  songTitle: string
}

export default function PunchlineSubmit({ songId, songTitle }: PunchlineSubmitProps) {
  const [open, setOpen] = useState(false)
  const [quote, setQuote] = useState('')
  const [context, setContext] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')

    try {
      const res = await fetch('/api/punchlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId, quote, context }),
      })
      if (res.status === 401) {
        openSignIn()
        setStatus('idle')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setError(data.error || 'Erreur lors de la soumission.')
        return
      }
      setStatus('sent')
      setQuote('')
      setContext('')
      setTimeout(() => {
        setOpen(false)
        setStatus('idle')
      }, 2000)
    } catch {
      setStatus('error')
      setError('Impossible de contacter le serveur.')
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper shadow-lift transition-all hover:-translate-y-0.5 hover:bg-red sm:bottom-8 sm:right-8"
        >
          <i className="fa-solid fa-quote-left text-xs" aria-hidden="true" />
          <span className="hidden sm:inline">Proposer une punchline</span>
          <span className="sm:hidden">Punchline</span>
        </button>
      )}

      {/* Panneau de saisie */}
      {open && (
        <div className="fixed bottom-6 right-6 z-30 w-[calc(100vw-2rem)] max-w-sm sm:bottom-8 sm:right-8">
          <div className="overflow-hidden rounded-xl border border-line-strong bg-card shadow-card">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-ink">Proposer une punchline</h3>
                <p className="truncate text-[11px] text-ink-faint">de « {songTitle} »</p>
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); setStatus('idle') }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint hover:bg-paper-deep hover:text-ink"
                aria-label="Fermer"
              >
                <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-4">
              {status === 'sent' ? (
                <div className="py-4 text-center">
                  <i className="fa-solid fa-circle-check text-2xl text-green" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-ink">Punchline proposée !</p>
                  <p className="mt-1 text-xs text-ink-soft">Elle apparaîtra après validation.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-ink-soft">
                    La punchline
                    <textarea
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      required
                      rows={2}
                      maxLength={300}
                      placeholder="Coller la ligne marquante…"
                      className="input text-sm"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-ink-soft">
                    Pourquoi c&apos;est bon ? (optionnel)
                    <input
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Le sens caché, la référence…"
                      className="input text-sm"
                    />
                  </label>

                  {status === 'error' && (
                    <p className="text-xs text-red">
                      <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
                      {error}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-ink-faint">
                      {quote.length}/300
                    </span>
                    <button
                      type="submit"
                      disabled={status === 'sending' || quote.trim().length < 4}
                      className="btn btn-primary btn-sm"
                    >
                      {status === 'sending' ? (
                        <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Envoi…</>
                      ) : (
                        <><i className="fa-solid fa-paper-plane" aria-hidden="true" /> Proposer</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
