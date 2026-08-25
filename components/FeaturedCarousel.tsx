'use client'

/**
 * FeaturedCarousel — les 3 premiers titres du top en cartes « Titre du jour »
 * swipeables (façon Genius). Remplace la carte unique fixe.
 *
 * • Swipe horizontal (gauche/droite) avec drag élastique pendant le geste
 * • Flèches + points de pagination (touch targets 44px)
 * • Auto-rotation douce (7s) stoppée dès la première interaction
 * • Carte entièrement tappable sur mobile (overlay sm:hidden, CTA au-dessus)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import CoverImage from './CoverImage'

export interface FeaturedCardData {
  slug: string
  title: string
  artist: string
  album: string
  coverUrl?: string | null
  annotationCount: number
  /** Rang dans le top (1 = titre du jour). */
  rank: number
  /** Lignes de paroles pré-découpées côté serveur, passages annotés inclus. */
  lines: { key: string; spans: { text: string; body: string | null }[] }[]
  note: { body: string; author: string; tags?: string[] } | null
}

const AUTOPLAY_MS = 7000

export default function FeaturedCarousel({ cards }: { cards: FeaturedCardData[] }) {
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [autoPaused, setAutoPaused] = useState(false)

  // Geste tactile
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const locked = useRef<'none' | 'x' | 'y'>('none')

  const goTo = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(cards.length - 1, i)))
    setAutoPaused(true)
  }, [cards.length])

  // Auto-rotation (stop net dès interaction utilisateur)
  useEffect(() => {
    if (autoPaused || cards.length < 2) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % cards.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [autoPaused, cards.length])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    locked.current = 'none'
    setAutoPaused(true)
  }, [])

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return
      const t = e.touches[0]
      const dx = t.clientX - touchStart.current.x
      const dy = t.clientY - touchStart.current.y

      // Verrouillage de l'axe : on ne capte que les gestes horizontaux
      if (locked.current === 'none') {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) locked.current = 'x'
        else if (Math.abs(dy) > 12) locked.current = 'y'
      }
      if (locked.current !== 'x') return

      // Résistance aux bords (première/dernière carte)
      const atEdge = (index === 0 && dx > 0) || (index === cards.length - 1 && dx < 0)
      setDragging(true)
      setDrag(atEdge ? dx * 0.25 : dx)
    },
    [index, cards.length],
  )

  const onTouchEnd = useCallback(() => {
    touchStart.current = null
    locked.current = 'none'
    setDragging(false)
    setDrag((d) => {
      if (Math.abs(d) > 60) {
        setIndex((i) => Math.max(0, Math.min(cards.length - 1, i + (d < 0 ? 1 : -1))))
      }
      return 0
    })
  }, [cards.length])

  if (cards.length === 0) return null

  return (
    <div className="featured rise relative overflow-hidden" style={{ animationDelay: '180ms' }}>
      {/* Barre de titre + navigation */}
      <div className="featured-top">
        <span className="eyebrow">
          <i className="fa-solid fa-star" aria-hidden="true" />
          {cards[index]?.rank === 1 ? 'Titre du jour' : `N°${cards[index]?.rank ?? 1} du top`}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.13em] text-ink-faint min-[420px]:block">
            Choisi par la rédaction
          </span>
          {cards.length > 1 && (
            <span className="flex items-center gap-1" role="tablist" aria-label="Titres du jour">
              {cards.map((c, i) => (
                <button
                  key={c.slug}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Voir ${c.title}`}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? 'w-5 bg-red' : 'w-1.5 bg-line-strong hover:bg-red/50'
                  }`}
                />
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Piste des cartes */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="touch-pan-y"
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
            transition: dragging
              ? 'none'
              : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {cards.map((card) => (
            <article key={card.slug} className="relative w-full shrink-0">
              <div className="p-5 sm:p-7">
                {/* Cover + identité */}
                <div className="flex items-center gap-3">
                  <CoverImage
                    src={card.coverUrl}
                    alt={`Couverture de « ${card.title} »`}
                    size="card"
                    eager
                    className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-[4px] border border-line-strong object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-grotesk text-lg sm:text-xl font-bold text-ink">
                      {card.title}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-ink-faint">
                      {card.artist} · {card.album}
                    </div>
                  </div>
                </div>

                {/* Paroles annotées */}
                <div className="lyric-block mt-4 sm:mt-5">
                  {card.lines.map((line) => (
                    <div key={line.key}>
                      {line.spans.map((sp, i) =>
                        sp.body ? (
                          <span key={i} className="annot" title={sp.body}>
                            {sp.text}
                            {i === 0 && (
                              <span className="annot-badge" aria-hidden="true">
                                {card.annotationCount}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span key={i}>{sp.text}</span>
                        ),
                      )}
                    </div>
                  ))}
                </div>

                {/* Note de la communauté */}
                {card.note ? (
                  <div className="note-card mt-4 sm:mt-5">
                    <div className="note-label">
                      Note de la communauté · {card.annotationCount} contribution
                      {card.annotationCount > 1 ? 's' : ''}
                    </div>
                    <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-ink-soft">
                      {card.note.body}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-ink-faint">
                      @{card.note.author}
                      {card.note.tags?.map((t) => ` #${t}`).join('')}
                    </p>
                  </div>
                ) : (
                  <div className="note-card mt-4 sm:mt-5">
                    <div className="note-label">À annoter</div>
                    <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-ink-soft">
                      Ce titre n&apos;a pas encore d&apos;explication — soyez la première voix.
                    </p>
                  </div>
                )}

                {/* Compteur + CTA */}
                <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                  <span className="text-center font-mono text-[11px] sm:text-left sm:text-xs text-ink-faint">
                    {card.annotationCount > 0
                      ? `${card.annotationCount} passage${card.annotationCount > 1 ? 's' : ''} annoté${card.annotationCount > 1 ? 's' : ''} sur ce titre`
                      : 'À annoter'}
                  </span>
                  <Link
                    href={`/songs/${card.slug}`}
                    className="btn btn-primary btn-sm btn-sharp relative z-20 w-full justify-center sm:w-auto"
                  >
                    <i className="fa-solid fa-book-open" aria-hidden="true" /> Ouvrir et annoter
                  </Link>
                </div>
              </div>

              {/* Overlay tappable mobile */}
              <Link
                href={`/songs/${card.slug}`}
                aria-label={`Ouvrir « ${card.title} » de ${card.artist}`}
                className="absolute inset-0 z-10 transition-colors active:bg-red/5 sm:hidden"
              />
            </article>
          ))}
        </div>
      </div>

      {/* Flèches desktop */}
      {cards.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Titre précédent"
              className="absolute left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-card/90 text-ink-soft shadow-sm backdrop-blur transition-colors hover:border-red hover:text-red sm:flex"
            >
              <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
            </button>
          )}
          {index < cards.length - 1 && (
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Titre suivant"
              className="absolute right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-card/90 text-ink-soft shadow-sm backdrop-blur transition-colors hover:border-red hover:text-red sm:flex"
            >
              <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
