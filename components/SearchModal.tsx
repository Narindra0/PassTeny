'use client'

/**
 * Recherche en modal — le remplaçant de la page /search.
 * Ouverte via l'événement global `passteny:open-search` (openSearch()).
 * Recherche débouncée sur /api/search, navigation clavier (↑↓ Entrée),
 * fermeture Échap / clic sur le voile, focus restauré sur le déclencheur.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export const SEARCH_OPEN_EVENT = 'passteny:open-search'

/** Ouvre la recherche depuis n'importe quel déclencheur (header, hero, footer…). */
export function openSearch() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT))
}

interface Result {
  slug: string
  artistSlug: string
  artist: string
  title: string
  album: string | null
}

interface ArtistResult {
  slug: string
  name: string
  songCount: number
}

export default function SearchModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [artists, setArtists] = useState<ArtistResult[]>([])
  const [searchedQuery, setSearchedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  /** « Recherche en cours » est dérivé : la requête tapée n'a pas encore été servie. */
  const hasQuery = query.trim().length >= 2
  const searching = hasQuery && query.trim() !== searchedQuery

  function resetResults() {
    setResults([])
    setArtists([])
    setSearchedQuery('')
    setActiveIndex(-1)
  }

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    resetResults()
    triggerRef.current?.focus()
  }, [])

  // ── Ouverture : mémorise le déclencheur (restauration du focus à la fermeture) ──
  useEffect(() => {
    const onOpen = () => {
      triggerRef.current = document.activeElement as HTMLElement
      setOpen(true)
    }
    window.addEventListener(SEARCH_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(SEARCH_OPEN_EVENT, onOpen)
  }, [])

  // ── Recherche débouncée + annulable (setState uniquement dans les callbacks async) ──
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
            signal: controller.signal,
          })
          if (res.ok) {
            const json = (await res.json()) as { results: Result[]; artists: ArtistResult[] }
            setResults(json.results)
            setArtists(json.artists ?? [])
            setActiveIndex(json.results.length > 0 ? 0 : -1)
            setSearchedQuery(q)
          }
        } catch {
          // requête annulée (abort) — état déjà géré
        }
      })()
    }, 220)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open])

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

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (results.length ? Math.min(i + 1, results.length - 1) : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      // Entrée → recherche approfondie (page /search), pas le premier résultat.
      e.preventDefault()
      const q = query.trim()
      if (q.length >= 2) {
        setOpen(false)
        router.push(`/search?q=${encodeURIComponent(q)}`)
      }
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
    <div className="fixed inset-0 z-50 overflow-y-auto px-4 pb-8 pt-[10vh]">
      {/* Voile */}
      <div
        aria-hidden="true"
        onClick={close}
        className="fixed inset-0 bg-ink/70 backdrop-blur-sm motion-safe:animate-[fadeIn_180ms_ease-out]"
      />

      {/* Panneau */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche dans le catalogue"
        onKeyDown={onPanelKeyDown}
        className="relative z-10 mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card motion-safe:animate-[modalIn_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Rangée de saisie */}
        <div className="flex items-center gap-3 border-b border-line px-5">
          <i className="fa-solid fa-magnifying-glass shrink-0 text-sm text-ink-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.trim().length < 2) resetResults()
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Rechercher un titre, un artiste, une parole…"
            aria-label="Rechercher dans le catalogue"
            autoComplete="off"
            spellCheck={false}
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
          {searching ? (
            <i className="fa-solid fa-spinner fa-spin shrink-0 text-sm text-ink-faint" aria-hidden="true" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                resetResults()
                inputRef.current?.focus()
              }}
              aria-label="Effacer la recherche"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
            >
              <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={close}
            aria-label="Fermer la recherche (Échap)"
            className="shrink-0 rounded-full border border-line-strong px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft transition-colors hover:border-ink hover:bg-ink hover:text-paper"
          >
            Échap
          </button>
        </div>

        {/* Résultats */}
        <div className="max-h-[52vh] overflow-y-auto">
          {hasQuery && searching && (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">
              <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />
              Recherche…
            </p>
          )}

          {hasQuery && !searching && (artists.length > 0 || results.length > 0) && (
            <>
              {/* Artistes — lien direct vers le profil */}
              {artists.length > 0 && (
                <div className="px-3 py-3">
                  <p className="px-2 pb-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    Artistes
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {artists.map((a) => (
                      <li key={a.slug}>
                        <Link
                          href={`/artists/${a.slug}`}
                          onClick={() => setOpen(false)}
                          className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-paper-alt"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-deep font-mono text-xs font-bold text-ink"
                            aria-hidden="true"
                          >
                            {a.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink transition-colors group-hover:text-red">
                            {a.name}
                          </span>
                          <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                            {a.songCount} titre{a.songCount > 1 ? 's' : ''}
                          </span>
                          <i
                            className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Titres — artiste cliquable vers son profil */}
              {results.length > 0 && (
                <div className={artists.length > 0 ? 'border-t border-line' : ''}>
                  {artists.length > 0 && (
                    <p className="px-5 pb-1 pt-3 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                      Titres
                    </p>
                  )}
                  <ul className="divide-y divide-[var(--line)]">
                    {results.map((r, i) => (
                      <li
                        key={r.slug}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`group flex items-center gap-3 px-5 py-3 transition-colors ${
                          i === activeIndex ? 'bg-paper-alt' : ''
                        }`}
                      >
                        <i
                          className={`fa-solid fa-music shrink-0 text-sm transition-colors ${
                            i === activeIndex ? 'text-red' : 'text-ink-faint'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/songs/${r.slug}`}
                            onClick={() => setOpen(false)}
                            className="block truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red"
                          >
                            {r.title}
                          </Link>
                          <Link
                            href={`/artists/${r.artistSlug}`}
                            onClick={() => setOpen(false)}
                            aria-label={`Voir le profil de ${r.artist}`}
                            className="block truncate text-sm text-ink-soft transition-colors hover:text-red"
                          >
                            {r.artist}
                            {r.album ? ` · ${r.album}` : ''}
                          </Link>
                        </div>
                        <Link
                          href={`/songs/${r.slug}`}
                          onClick={() => setOpen(false)}
                          aria-label={`Ouvrir ${r.title}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-all hover:text-red group-hover:translate-x-0.5"
                        >
                          <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {hasQuery && !searching && results.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">
              Aucun résultat pour « {query.trim()} ».
            </p>
          )}

          {!hasQuery && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-ink-soft">
                Tapez au moins 2 caractères — titre, artiste ou extrait de paroles, sans accents.
              </p>
              <p className="mt-3 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-faint">
                ↑↓ naviguer · Entrée : tout voir · Échap fermer
              </p>
            </div>
          )}
        </div>

        {/* Pied de modal — recherche approfondie sur la page dédiée */}
        {hasQuery && !searching && (
          <Link
            href={`/search?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
            className="group flex items-center justify-center gap-2 border-t border-line px-5 py-3.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-soft transition-colors hover:bg-paper-alt hover:text-red"
          >
            <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            Recherche approfondie — voir tous les résultats
          </Link>
        )}
      </div>
    </div>
  )
}
