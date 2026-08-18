'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setMessage('')
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setStatus('sent')
      setMessage('Lien de connexion envoyé — vérifiez votre boîte mail.')
    } else {
      setStatus('error')
      setMessage(data.error || 'Une erreur est survenue.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <div className="card p-8">
        <span className="sticker red">
          <i className="fa-solid fa-users mr-1.5" aria-hidden="true" />
          Communauté
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">Rejoindre la communauté</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Un lien magique vous sera envoyé par email — pas de mot de passe.
        </p>

        {status === 'sent' ? (
          <div className="mt-6 rounded-xl border-2 border-green bg-green/10 p-4 text-sm text-ink">
            <p className="font-semibold">
              <i className="fa-solid fa-circle-check mr-2 text-green" aria-hidden="true" />
              Lien envoyé
            </p>
            <p className="mt-1 text-ink-soft">{message}</p>
            <p className="mt-2">
              <Link href="/" className="font-medium text-red hover:underline">
                Retour à l’accueil
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="input"
              />
            </label>
            {status === 'error' && (
              <p className="text-sm text-red">
                <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn btn-primary w-full"
            >
              {status === 'sending' ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                  Envoi…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-envelope-open-text" aria-hidden="true" />
                  Recevoir le lien magique
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
