'use client'

/**
 * SwipeNav — navigation tactile entre titres d'une tracklist.
 *
 * Affiché uniquement sur mobile (lg:hidden) en bas de la section paroles.
 * Détecte un swipe horizontal (gauche = suivant, droite = précédent) avec
 * feedback visuel de rubber-band, puis navigue via Next.js router.
 *
 * Props :
 * - prev / next : { slug, title } ou null
 */
import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface TrackInfo {
  slug: string
  title: string
}

export default function SwipeNav({
  prev,
  next,
  currentTitle,
}: {
  prev: TrackInfo | null
  next: TrackInfo | null
  currentTitle: string
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)

  const MIN_SWIPE = 70
  const MAX_TIME = 350

  const navigate = useCallback(
    (slug: string) => {
      router.push(`/songs/${slug}`)
    },
    [router],
  )

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!prev && !next) return
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      setOffset(0)
      setSwiping(false)
      setSwipeDir(null)
    },
    [prev, next],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return
      const touch = e.touches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y

      // Si le mouvement est principalement vertical → scroll, on ignore
      if (Math.abs(dy) > Math.abs(dx) * 0.6 && !swiping) return

      // Engager le swipe si suffisamment horizontal
      if (Math.abs(dx) > 15 && !swiping) {
        setSwiping(true)
      }

      if (!swiping && !prev && dx > 0) return // pas de prev = pas de swipe droit
      if (!swiping && !next && dx < 0) return // pas de next = pas de swipe gauche

      // Rubber-band avec résistance progressive
      const resistance = 0.4
      const clamped = dx * resistance
      setOffset(clamped)
      setSwipeDir(dx < 0 ? 'left' : 'right')
    },
    [swiping, prev, next],
  )

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current) return
    const elapsed = Date.now() - touchStart.current.time
    touchStart.current = null

    const absOffset = Math.abs(offset)
    const triggered = absOffset > MIN_SWIPE && elapsed < MAX_TIME

    if (triggered) {
      if (offset < 0 && next) {
        navigate(next.slug)
      } else if (offset > 0 && prev) {
        navigate(prev.slug)
      }
    }

    // Reset animation
    setOffset(0)
    setSwiping(false)
    setSwipeDir(null)
  }, [offset, prev, next, navigate])

  // Ne rien afficher si pas de navigation possible
  if (!prev && !next) return null

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Swipe zone — overlay transparent au-dessus des boutons */}
      <div
        className="relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Indicateur visuel de swipe en cours */}
        {swiping && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-2 transition-opacity"
            style={{ opacity: Math.min(Math.abs(offset) / MIN_SWIPE, 1) }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1 text-[11px] font-medium text-paper backdrop-blur-sm">
              {swipeDir === 'left' && next && (
                <>
                  <span className="truncate max-w-[120px]">{next.title}</span>
                  <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true" />
                </>
              )}
              {swipeDir === 'right' && prev && (
                <>
                  <i className="fa-solid fa-arrow-left text-[10px]" aria-hidden="true" />
                  <span className="truncate max-w-[120px]">{prev.title}</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Barre de navigation */}
        <div
          className="flex border-t border-line-strong bg-card/95 backdrop-blur-md transition-transform"
          style={{
            transform: `translateX(${offset}px)`,
            transition: swiping ? 'none' : 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {prev ? (
            <Link
              href={`/songs/${prev.slug}`}
              className="group flex min-h-[52px] flex-1 items-center gap-2.5 border-r border-line px-4 py-3 transition-colors hover:bg-paper-alt"
            >
              <i className="fa-solid fa-arrow-left text-xs text-ink-faint transition-colors group-hover:text-red" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
                  Précédent
                </div>
                <div className="truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-red">
                  {prev.title}
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          {next ? (
            <Link
              href={`/songs/${next.slug}`}
              className="group flex min-h-[52px] flex-1 items-center justify-end gap-2.5 px-4 py-3 text-right transition-colors hover:bg-paper-alt"
            >
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
                  Suivant
                </div>
                <div className="truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-red">
                  {next.title}
                </div>
              </div>
              <i className="fa-solid fa-arrow-right text-xs text-ink-faint transition-colors group-hover:text-red" aria-hidden="true" />
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </div>
  )
}
