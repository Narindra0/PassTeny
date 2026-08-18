'use client'

import { useState } from 'react'

interface OnboardingFormProps {
  initialUsername: string
  next?: string
}

type FieldErrors = Partial<Record<'username' | 'facebook_url' | 'instagram_url', string>>

export default function OnboardingForm({ initialUsername, next }: OnboardingFormProps) {
  const [username, setUsername] = useState(initialUsername)
  const [facebookUrl, setFacebookUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving'>('idle')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setFieldErrors({})
    setGlobalError('')

    const res = await fetch('/api/auth/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        facebook_url: facebookUrl || null,
        instagram_url: instagramUrl || null,
      }),
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
      return
    }

    setStatus('idle')
    if (data.field && (data.field === 'username' || data.field === 'facebook_url' || data.field === 'instagram_url')) {
      setFieldErrors({ [data.field]: data.error })
    } else {
      setGlobalError(data.error || 'Une erreur est survenue.')
    }
  }

  const fieldClass = (hasError: boolean) => `input ${hasError ? 'border-red' : ''}`

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <div className="card p-8">
        <span className="sticker red">
          <i className="fa-solid fa-wand-magic-sparkles mr-1.5" aria-hidden="true" />
          Bienvenue
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
          Dernière étape : votre profil
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Choisissez le pseudo qui signera vos annotations. Les liens Facebook et Instagram sont
          optionnels — ils permettent à la communauté de vous retrouver.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Pseudo
            <input
              type="text"
              required
              minLength={3}
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="votre-pseudo"
              className={fieldClass(Boolean(fieldErrors.username))}
              aria-invalid={Boolean(fieldErrors.username)}
            />
            {fieldErrors.username ? (
              <span className="text-xs text-red">{fieldErrors.username}</span>
            ) : (
              <span className="text-xs text-ink-soft">3 à 24 caractères — lettres, chiffres, . _ -</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            <span className="inline-flex items-center gap-1.5">
              <i className="fa-brands fa-facebook-f text-red" aria-hidden="true" />
              Page Facebook <span className="font-normal text-ink-soft">(optionnel)</span>
            </span>
            <input
              type="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/votre-page"
              className={fieldClass(Boolean(fieldErrors.facebook_url))}
              aria-invalid={Boolean(fieldErrors.facebook_url)}
            />
            {fieldErrors.facebook_url && <span className="text-xs text-red">{fieldErrors.facebook_url}</span>}
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            <span className="inline-flex items-center gap-1.5">
              <i className="fa-brands fa-instagram text-red" aria-hidden="true" />
              Page Instagram <span className="font-normal text-ink-soft">(optionnel)</span>
            </span>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/votre-page"
              className={fieldClass(Boolean(fieldErrors.instagram_url))}
              aria-invalid={Boolean(fieldErrors.instagram_url)}
            />
            {fieldErrors.instagram_url && <span className="text-xs text-red">{fieldErrors.instagram_url}</span>}
          </label>

          {globalError && (
            <p className="text-sm text-red">
              <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />
              {globalError}
            </p>
          )}

          <button type="submit" disabled={status === 'saving'} className="btn btn-primary w-full">
            {status === 'saving' ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                <i className="fa-solid fa-circle-check" aria-hidden="true" />
                Rejoindre la communauté
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
