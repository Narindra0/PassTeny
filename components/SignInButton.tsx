'use client'

/**
 * Bouton « Se connecter » — client component qui déclenche la modal SignInModal.
 */
import { openSignIn } from '@/components/SignInModal'

export default function SignInButton() {
  return (
    <button
      type="button"
      onClick={openSignIn}
      className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink transition-all hover:-translate-y-0.5 hover:border-red hover:bg-red hover:text-white"
    >
      <i className="fa-solid fa-user" aria-hidden="true" />
      Se connecter
    </button>
  )
}
