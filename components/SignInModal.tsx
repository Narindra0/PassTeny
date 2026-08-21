'use client'

/**
 * Modal de connexion — lien magique par email.
 * Ouverte via l'événement global `passteny:open-signin` (openSignIn()).
 * Focus trap, fermeture Échap / clic voile, focus restauré sur le déclencheur.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import { config } from '@/lib/config'

export const SIGNIN_OPEN_EVENT = 'passteny:open-signin'

/** Ouvre la modal de connexion depuis n'importe quel déclencheur. */
export function openSignIn() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SIGNIN_OPEN_EVENT))
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function SignInModal() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  // `view` = ce qu'on affiche visuellement (form | sent) — séparé de `status`
  // pour garder le formulaire visible pendant l'animation de sortie.
  const [view, setView] = useState<'form' | 'sent'>('form')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setEmail('')
    setStatus('idle')
    setMessage('')
    setView('form')
    triggerRef.current?.focus()
  }, [])

  // ── Ouverture : mémorise le déclencheur ──
  useEffect(() => {
    const onOpen = () => {
      triggerRef.current = document.activeElement as HTMLElement
      setOpen(true)
    }
    window.addEventListener(SIGNIN_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(SIGNIN_OPEN_EVENT, onOpen)
  }, [])

  // ── Échap, verrouillage du scroll, focus initial ──
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      cancelAnimationFrame(raf)
    }
  }, [open, close])

  // ── Soumission du formulaire (magic link) ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setMessage('')
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMessage('Lien de connexion envoyé — vérifiez votre boîte mail.')
        // Petit délai pour que le bouton « Envoi… » reste visible un instant
        // avant le crossfade vers l'état succès.
        await new Promise((r) => setTimeout(r, 280))
        setStatus('sent')
        setView('sent')
      } else {
        setStatus('error')
        setMessage(data.error || 'Une erreur est survenue.')
      }
    } catch {
      setStatus('error')
      setMessage('Impossible de contacter le serveur.')
    }
  }

  // Piège à focus : Tab reste dans la modal.
  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusables || focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Voile — masqué mobile (sheet couvre tout), visible desktop */}
      <div
        aria-hidden="true"
        onClick={close}
        className="fixed inset-0 bg-ink/70 backdrop-blur-sm motion-safe:animate-[fadeIn_180ms_ease-out] max-sm:hidden"
      />

      {/* Panneau — sheet mobile (slide-up plein écran) / modal centrée desktop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connexion à Pass'Teny"
        onKeyDown={onPanelKeyDown}
        className={
          'relative z-10 mx-auto my-auto w-full max-w-sm overflow-hidden bg-card '
          + 'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:rounded-t-2xl '
          + 'max-sm:animate-[sheetSlideUp_350ms_cubic-bezier(0.22,1,0.36,1)] '
          + 'sm:rounded-2xl sm:border sm:border-line-strong sm:shadow-card '
          + 'sm:animate-[modalIn_220ms_cubic-bezier(0.22,1,0.36,1)]'
        }
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        {/* Bandeau lamba — toujours visible */}
        <div className="flagbar shrink-0" aria-hidden="true">
          <span className="bg-red" />
          <span className="bg-green" />
          <span className="bg-mustard" />
          <span className="bg-ink" />
        </div>

        {/* En-tête — crossfade entre les deux titres */}
        <div className="px-5 pt-5 pb-0 sm:px-7 sm:pt-6">
          <div className="flex items-start justify-between">
            <div className="relative min-h-[70px]">
              {/* Titre formulaire */}
              <div
                className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  view === 'sent'
                    ? 'pointer-events-none absolute inset-0 translate-y-2 opacity-0'
                    : 'relative'
                }`}
              >
                <span className="eyebrow">
                  <i className="fa-solid fa-users mr-0.5" aria-hidden="true" />
                  Communauté
                </span>
                <h2 className="mt-2 font-grotesk text-xl font-bold tracking-tight text-ink">
                  Rejoindre la communauté
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Connectez-vous avec Google ou recevez un lien magique par email.
                </p>
              </div>
              {/* Titre succès */}
              <div
                className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  view === 'sent'
                    ? 'relative crossfade-enter'
                    : 'pointer-events-none absolute inset-0 -translate-y-2 opacity-0'
                }`}
              >
                <span className="eyebrow">
                  <i className="fa-solid fa-circle-check mr-0.5" aria-hidden="true" />
                  Envoyé
                </span>
                <h2 className="mt-2 font-grotesk text-xl font-bold tracking-tight text-ink">
                  Vérifiez votre boîte mail
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Le lien de connexion vous attend dans votre boîte de réception.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fermer (Échap)"
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
            >
              <i className="fa-solid fa-xmark text-base" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Corps — crossfade entre formulaire et succès */}
        <div className="relative overflow-hidden">
          {/* ── Formulaire ── */}
          <div
            className={`px-5 py-4 sm:px-7 sm:py-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              view === 'sent'
                ? 'pointer-events-none absolute inset-0 translate-y-2 opacity-0'
                : 'relative z-10'
            }`}
          >
            {/* ── Google OAuth ── */}
            <button
              type="button"
              onClick={async () => {
                const supabase = getSupabase()
                if (!supabase) return
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${config.siteUrl}/auth/callback`,
                  },
                })
              }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-card px-4 py-2.5 text-sm font-medium text-ink transition-all hover:border-ink hover:bg-paper-alt"
            >
              {/* Logo Google (SVG inline) */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuer avec Google
            </button>

            {/* Séparateur */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-ink-faint">ou par email</span>
              </div>
            </div>

            {/* ── Magic link email ── */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                Adresse email
                <input
                  ref={inputRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (status === 'error') {
                      setStatus('idle')
                      setMessage('')
                    }
                  }}
                  placeholder="vous@exemple.com"
                  className="input"
                  autoComplete="email"
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
                className="btn btn-primary btn-sm w-full"
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
          </div>

          {/* ── Succès ── */}
          <div
            className={`p-5 pt-4 sm:p-7 sm:pt-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              view === 'sent'
                ? 'relative z-10 crossfade-enter'
                : 'pointer-events-none absolute inset-0 -translate-y-2 opacity-0'
            }`}
          >
            <div className="rounded-xl border-2 border-green bg-green/10 p-5">
              <p className="font-semibold text-ink">
                <i className="fa-solid fa-circle-check mr-2 text-green" aria-hidden="true" />
                Lien envoyé
              </p>
              <p className="mt-1.5 text-sm text-ink-soft">{message}</p>
              <button
                type="button"
                onClick={close}
                className="btn btn-secondary btn-sm mt-4 w-full"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
                Fermer
              </button>
            </div>
          </div>
        </div>

        {/* Pied de modal */}
        <div className="border-t border-line px-5 py-3 sm:px-7 sm:py-3">
          <p className="text-center text-xs text-ink-faint">
            En continuant, vous acceptez les conditions d&apos;utilisation de Pass&apos;Teny.
          </p>
        </div>
      </div>
    </div>
  )
}
