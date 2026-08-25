'use client'

/**
 * Navbar adaptative — s'adapte au contexte de la page courante.
 *
 * • Landing / pages générales : liens classiques (Découvrir, Chart, Artistes)
 * • Page détail (/songs|artists|albums/[slug]) : onglets sections après scroll
 * • Mobile : hamburger → drawer latéral animé + liens complets
 * • Scroll : ombre + fond plus opaque quand on dépasse le hero
 *
 * `authBar` est un ReactNode passé depuis le layout server.
 */
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SearchTrigger from './SearchTrigger'

// ── Liens landing ────────────────────────────────────────────────────────

const LANDING_LINKS = [
  { href: '/discover', label: 'Découvrir' },
  { href: '/magazine', label: 'Magazine' },
  { href: '/chart', label: 'Chart' },
  { href: '/#artistes', label: 'Artistes' },
]

// ── Onglets par type de page ─────────────────────────────────────────────

const PAGE_TABS: Record<string, { anchor: string; label: string; icon: string }[]> = {
  song: [
    { anchor: '#paroles', label: 'Paroles', icon: 'fa-solid fa-align-left' },
    { anchor: '#tracklist', label: 'Tracklist', icon: 'fa-solid fa-list-ol' },
  ],
  artist: [
    { anchor: '#top', label: 'Top', icon: 'fa-solid fa-ranking-star' },
    { anchor: '#releases', label: 'Releases', icon: 'fa-solid fa-compact-disc' },
  ],
  album: [
    { anchor: '#tracklist', label: 'Tracklist', icon: 'fa-solid fa-list-ol' },
    { anchor: '#discographie', label: 'Discographie', icon: 'fa-solid fa-compact-disc' },
  ],
}

function getPageType(pathname: string): keyof typeof PAGE_TABS | null {
  if (/^\/songs\/[^/]+/.test(pathname)) return 'song'
  if (/^\/artists\/[^/]+/.test(pathname)) return 'artist'
  if (/^\/albums\/[^/]+/.test(pathname)) return 'album'
  return null
}

/** Détermine si un lien est actif (correspond à la page courante). */
function isActive(href: string, pathname: string): boolean {
  if (href.startsWith('/#')) return false // ancres de la landing
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href) && pathname[href.length] !== '/'
}

// ── Composant ────────────────────────────────────────────────────────────

export default function Navbar({ authBar }: { authBar: ReactNode }) {
  const pathname = usePathname()
  const pageType = getPageType(pathname)
  const tabs = pageType ? PAGE_TABS[pageType] : null
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobilePanelRef = useRef<HTMLDivElement>(null)

  // ── Scroll listener ──
  useEffect(() => {
    const THRESHOLD = 260
    const onScroll = () => setScrolled(window.scrollY > THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Scroll spy ──
  useEffect(() => {
    if (!tabs) return
    const anchors = tabs.map((t) => t.anchor.slice(1))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveTab(`#${entry.target.id}`)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    for (const id of anchors) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [tabs, pathname])

  // ── Reset au changement de page ──
  useEffect(() => {
    setActiveTab(null)
    setScrolled(false)
    setMobileOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  // ── Fermer le mobile au Escape ──
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // ── Lock body scroll quand mobile est ouvert ──
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const showTabs = Boolean(pageType) && scrolled
  const showLandingLinks = !pageType || !scrolled

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b transition-shadow duration-300 ${
          scrolled
            ? 'border-line-strong bg-paper/95 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
            : 'border-line bg-paper/90 backdrop-blur-sm'
        }`}
      >
        {/* Flagbar */}
        <div className="flagbar !h-[3px]" aria-hidden="true">
          <span className="bg-red" />
          <span className="bg-green" />
          <span className="bg-mustard" />
          <span className="bg-ink" />
        </div>

        <div className="relative mx-auto flex h-[52px] w-full max-w-5xl items-center justify-between gap-2 px-3 sm:h-[54px] sm:px-5">
          {/* ══ Gauche : marque + nav ══ */}
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {/* Marque */}
            <Link href="/" className="group inline-flex shrink-0 items-center gap-1.5">
              <span
                className={`lamba-mark transition-all duration-300 ${
                  scrolled ? 'scale-75 group-hover:rotate-[135deg]' : 'group-hover:rotate-[135deg]'
                }`}
                aria-hidden="true"
              />
              <span className={`font-grotesk font-bold tracking-tight text-ink transition-all duration-300 group-hover:text-red ${
                scrolled ? 'text-[0.95rem] sm:text-[1rem]' : 'text-[1.05rem] sm:text-[1.1rem]'
              }`}>
                Pass<span className="text-red">&apos;</span>Teny
              </span>
            </Link>

            {/* ── Nav desktop ── */}
            <nav className="ml-1.5 hidden items-center gap-0.5 sm:ml-3 lg:flex">
              {/* Liens landing */}
              {showLandingLinks && (
                <span className="contents">
                  {LANDING_LINKS.map((link) => {
                    const active = isActive(link.href, pathname)
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-all ${
                          pageType && scrolled
                            ? 'pointer-events-none absolute opacity-0'
                            : active
                              ? 'bg-ink text-paper'
                              : 'relative text-ink-soft hover:bg-paper-deep hover:text-ink'
                        }`}
                      >
                        {link.label}
                        {active && (
                          <span className="inline-block h-1 w-1 rounded-full bg-red" aria-hidden="true" />
                        )}
                      </Link>
                    )
                  })}
                </span>
              )}

              {/* Onglets sections (après scroll sur pages détail) */}
              {tabs && (
                <span className={`contents transition-all duration-300 ${scrolled ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}`}>
                  <span className="mr-1 text-line-strong" aria-hidden="true">/</span>
                  {tabs.map((tab) => {
                    const isActiveTab = activeTab === tab.anchor
                    return (
                      <a
                        key={tab.anchor}
                        href={tab.anchor}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-all ${
                          isActiveTab
                            ? 'bg-ink text-paper'
                            : 'text-ink-soft hover:bg-paper-deep hover:text-ink'
                        }`}
                      >
                        <i className={`text-[0.65rem] ${tab.icon}`} aria-hidden="true" />
                        <span className="hidden md:inline">{tab.label}</span>
                      </a>
                    )
                  })}
                </span>
              )}
            </nav>
          </div>

          {/* ══ Droite : recherche + auth + hamburger ══ */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <SearchTrigger
              label="Rechercher"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
            >
              <i className="fa-solid fa-magnifying-glass text-[0.8rem]" aria-hidden="true" />
            </SearchTrigger>

            {authBar}

            {/* Hamburger mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileOpen}
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink lg:hidden"
            >
              <span className="relative flex h-4 w-3.5 flex-col justify-between">
                <span
                  className={`block h-[1.5px] w-full origin-center rounded-full bg-current transition-all duration-300 ${
                    mobileOpen ? 'translate-y-[7px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-full rounded-full bg-current transition-all duration-200 ${
                    mobileOpen ? 'scale-x-0 opacity-0' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-full origin-center rounded-full bg-current transition-all duration-300 ${
                    mobileOpen ? '-translate-y-[7px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Drawer mobile ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* Backdrop */}
      <div
        onClick={closeMobile}
        className={`fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={mobilePanelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        className={`fixed top-0 right-0 z-50 flex h-full w-[min(85vw,320px)] flex-col bg-paper shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header drawer */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <Link href="/" onClick={closeMobile} className="group inline-flex items-center gap-1.5">
            <span className="lamba-mark" aria-hidden="true" />
            <span className="font-grotesk text-[1.05rem] font-bold tracking-tight text-ink group-hover:text-red">
              Pass<span className="text-red">&apos;</span>Teny
            </span>
          </Link>
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Fermer le menu"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
          </button>
        </div>

        {/* Flagbar */}
        <div className="flagbar !h-[2px]" aria-hidden="true">
          <span className="bg-red" />
          <span className="bg-green" />
          <span className="bg-mustard" />
          <span className="bg-ink" />
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {LANDING_LINKS.map((link) => {
              const active = isActive(link.href, pathname)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-ink text-paper'
                      : 'text-ink hover:bg-paper-deep hover:text-ink'
                  }`}
                >
                  <i className={`w-5 text-center text-xs ${active ? 'text-paper/60' : 'text-ink-faint'}`} aria-hidden="true" />
                  {link.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Séparateur */}
          <div className="my-4 border-t border-line" />

          {/* Onglets sections (si page détail) */}
          {tabs && (
            <div className="space-y-1">
              <span className="mb-2 block px-4 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-ink-faint">
                Sections
              </span>
              {tabs.map((tab) => {
                const isActiveTab = activeTab === tab.anchor
                return (
                  <a
                    key={tab.anchor}
                    href={tab.anchor}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all ${
                      isActiveTab
                        ? 'bg-ink text-paper'
                        : 'text-ink hover:bg-paper-deep hover:text-ink'
                    }`}
                  >
                    <i className={`w-5 text-center text-xs ${isActiveTab ? 'text-paper/60' : 'text-ink-faint'}`} aria-hidden="true" />
                    {tab.label}
                  </a>
                )
              })}
            </div>
          )}
        </nav>

        {/* Footer drawer */}
        <div className="border-t border-line px-5 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
            Le catalogue malgache
          </p>
        </div>
      </div>
    </>
  )
}
