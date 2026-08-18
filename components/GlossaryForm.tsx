'use client'

/**
 * Proposition d'un terme au glossaire (ohabolana, expression locale…).
 * Soumis en attente d'approbation par la communauté.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GlossaryForm() {
  const router = useRouter()
  const [term, setTerm] = useState('')
  const [meaning, setMeaning] = useState('')
  const [example, setExample] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    const res = await fetch('/api/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, meaning, language: 'mg', example }),
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
    setTerm('')
    setMeaning('')
    setExample('')
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-lg font-semibold text-ink">
        <i className="fa-solid fa-feather-pointed mr-2 text-red" aria-hidden="true" />
        Proposer un terme
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Ohabolana, expressions, double-sens… soumettez-le, la communauté l’approuvera.
      </p>

      {status === 'sent' ? (
        <p className="mt-4 rounded-xl border border-green/40 bg-green/10 p-4 text-sm text-ink">
          <i className="fa-solid fa-circle-check mr-2 text-green" aria-hidden="true" />
          Terme proposé — en attente d’approbation.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Terme / expression
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              required
              placeholder="Ex. : Ny aina aza very, ny haja no tiana"
              className="input mt-1 font-normal normal-case tracking-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Signification
            <textarea
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              required
              rows={2}
              placeholder="Ce que cela signifie, le contexte d'usage…"
              className="input mt-1 font-normal normal-case tracking-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Exemple d{"'"}usage (optionnel)
            <input
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Dans quelle situation on l'emploie…"
              className="input mt-1 font-normal normal-case tracking-normal"
            />
          </label>
          {status === 'error' && (
            <p className="text-xs font-medium text-red">
              <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="btn btn-primary mt-1"
          >
            {status === 'sending' ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                Envoi…
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                Proposer
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
