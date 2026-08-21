'use client'

/**
 * Menu du compte connecté (header) — remplace l'affichage brut email +
 * déconnexion par un profil invitant : avatar, pseudo, accès rapides.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signOutAction } from '@/lib/actions/auth'

interface AccountMenuProps {
  username: string
  email: string
  role: 'contributor' | 'trusted' | 'moderator'
}

const ROLE_LABEL: Record<AccountMenuProps['role'], string> = {
  contributor: 'Contributeur',
  trusted: 'Contributeur de confiance',
  moderator: 'Modérateur',
}

export default function AccountMenu({ username, email, role }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Fermeture au clic extérieur / Échap (setState dans les handlers, pas l'effet).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Compte de ${username}`}
        className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card py-1 pl-1 pr-2.5 text-ink transition-all hover:-translate-y-0.5 hover:border-red hover:bg-red hover:text-white"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-red font-mono text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          {username.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[100px] truncate font-mono text-[10px] font-semibold uppercase tracking-wider sm:block">
          {username}
        </span>
        <i
          className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu du compte"
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-paper/20 bg-ink shadow-card motion-safe:animate-[fadeIn_150ms_ease-out]"
        >
          {/* En-tête du profil */}
          <div className="flex items-center gap-3 border-b border-paper/10 px-4 py-4">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mustard font-mono text-base font-bold text-ink"
              aria-hidden="true"
            >
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold text-paper">
                @{username}
              </span>
              <span className="block truncate font-mono text-[0.58rem] uppercase tracking-[0.16em] text-paper/50">
                {ROLE_LABEL[role] ?? role} · {email}
              </span>
            </span>
          </div>

          <nav className="p-1.5">
            <Link
              href="/add-lyrics"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-paper/85 transition-colors hover:bg-paper/10 hover:text-paper"
            >
              <i className="fa-solid fa-file-pen w-4 text-mustard" aria-hidden="true" />
              Ajouter une parole
            </Link>
            {role === 'moderator' && (
              <Link
                href="/moderation"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-paper/85 transition-colors hover:bg-paper/10 hover:text-paper"
              >
                <i className="fa-solid fa-gavel w-4 text-mustard" aria-hidden="true" />
                Modération
              </Link>
            )}
          </nav>

          <form action={signOutAction} className="border-t border-paper/10 p-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-paper/85 transition-colors hover:bg-red hover:text-white"
            >
              <i className="fa-solid fa-right-from-bracket w-4" aria-hidden="true" />
              Déconnexion
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
