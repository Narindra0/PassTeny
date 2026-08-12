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
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Proposer un terme</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Ohabolana, expressions, double-sens… soumettez-le, la communauté l’approuvera.
      </p>

      {status === 'sent' ? (
        <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          ✓ Terme proposé — en attente d’approbation.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Terme / expression
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              required
              placeholder="Ex. : Ny aina aza very, ny haja no tiana"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Signification
            <textarea
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              required
              rows={2}
              placeholder="Ce que cela signifie, le contexte d'usage…"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Exemple d{"'"}usage (optionnel)
            <input
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Dans quelle situation on l'emploie…"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          {status === 'error' && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {status === 'sending' ? 'Envoi…' : 'Proposer'}
          </button>
        </form>
      )}
    </div>
  )
}
