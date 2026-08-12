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
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight">Rejoindre la communauté</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Un lien magique vous sera envoyé par email — pas de mot de passe.
        </p>

        {status === 'sent' ? (
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {message}
            <p className="mt-2">
              <Link href="/" className="font-medium underline">
                Retour à l’accueil
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            {status === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {status === 'sending' ? 'Envoi…' : 'Recevoir le lien magique'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
