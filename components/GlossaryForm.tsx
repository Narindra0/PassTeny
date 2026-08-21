'use client'

/**
 * Proposition d'un terme au glossaire (ohabolana, expression locale…).
 * Soumis en attente d'approbation par la communauté.
 */
import { useState } from 'react'
import { openSignIn } from '@/components/SignInModal'

const LANGUAGES = [
  { value: 'mg', label: 'Malgache' },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
]

export default function GlossaryForm() {
  const [term, setTerm] = useState('')
  const [meaning, setMeaning] = useState('')
  const [example, setExample] = useState('')
  const [language, setLanguage] = useState('mg')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    const res = await fetch('/api/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, meaning, language, example }),
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
    setTerm('')
    setMeaning('')
    setExample('')
  }

  if (status === 'sent') {
    return (
      <div className="card p-6">
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green/10">
            <i className="fa-solid fa-circle-check text-xl text-green" aria-hidden="true" />
          </span>
          <p className="mt-3 font-semibold text-ink">Terme proposé !</p>
          <p className="mt-1 text-sm text-ink-soft">
            Il apparaîtra ici après approbation par la communauté.
          </p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="btn btn-secondary btn-sm mt-4"
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Proposer un autre terme
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Terme / expression
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                required
                placeholder="Ex. : Ny aina aza very, ny haja no tiana"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Langue
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input w-auto"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Signification
            <textarea
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              required
              rows={3}
              placeholder="Ce que cela signifie, le contexte d'usage, l'origine…"
              className="input"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Exemple d&apos;usage (optionnel)
            <input
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Dans quelle situation on l'emploie…"
              className="input"
            />
          </label>

          {status === 'error' && (
            <p className="text-sm text-red">
              <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-faint">
              <i className="fa-solid fa-circle-info mr-1" aria-hidden="true" />
              Le terme sera vérifié avant publication.
            </p>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn btn-primary btn-sm"
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
          </div>
        </form>
      </div>
    </div>
  )
}
