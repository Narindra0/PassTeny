'use client'

/**
 * « À découvrir » — suggestions tirées au hasard dans le catalogue.
 * Le bouton « Encore » re-mélange avec une cascade d'apparition (card-pop).
 *
 * Hydratation : le mélange est **déterministe** — le serveur choisit une
 * graine aléatoire (`seed`, prop) et le client rejoue le même mélange
 * (PRNG mulberry32). Sans cela, le serveur et le client mélangeaient
 * chacun avec leur propre `Math.random()` → erreur d'hydratation.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import CoverImage from './CoverImage'

interface DiscoverSong {
  slug: string
  artistSlug: string
  title: string
  artist: string
  album: string
  coverUrl?: string | null
  annotationCount: number
}

/** PRNG déterministe (mulberry32) — même graine → même suite de nombres. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mélange de Fisher-Yates piloté par une graine. */
function seededShuffle(list: DiscoverSong[], seed: number): DiscoverSong[] {
  const rand = mulberry32(seed)
  const d = [...list]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[d[i], d[j]] = [d[j]!, d[i]!]
  }
  return d
}

export default function DiscoverRow({ songs, seed }: { songs: DiscoverSong[]; seed: number }) {
  const [deckSeed, setDeckSeed] = useState(seed)
  const [round, setRound] = useState(0)

  const deck = useMemo(() => seededShuffle(songs, deckSeed), [songs, deckSeed])

  function shuffle() {
    // Nouvelle graine au clic : re-mélange côté client uniquement (post-hydratation).
    setDeckSeed(Math.floor(Math.random() * 2 ** 31))
    setRound((r) => r + 1)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[2px] text-ink-faint">
          Le hasard propose, la communauté explique
        </p>
        <button
          type="button"
          onClick={shuffle}
          className="group inline-flex items-center gap-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[1.5px] text-ink-soft transition-colors hover:text-red"
        >
          <i
            className="fa-solid fa-shuffle text-xs transition-transform duration-500 group-hover:rotate-180"
            aria-hidden="true"
          />
          Encore
        </button>
      </div>

      <div key={round} className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {deck.slice(0, 6).map((s, i) => (
          <Link
            key={s.slug}
            href={`/songs/${s.slug}`}
            style={{ animationDelay: `${i * 45}ms` }}
            className="card-pop card card-hover group block p-3"
          >
            <CoverImage
              src={s.coverUrl}
              alt=""
              size="card"
              className="aspect-square w-full rounded-md border border-line-strong object-cover"
            />
            <div className="mt-3 truncate font-display text-[0.9rem] font-semibold text-ink transition-colors group-hover:text-red">
              {s.title}
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-soft">{s.artist}</div>
            {s.annotationCount > 0 ? (
              <div className="mt-2 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-red">
                <i className="fa-solid fa-pen-nib mr-1" aria-hidden="true" />
                {s.annotationCount} note{s.annotationCount > 1 ? 's' : ''}
              </div>
            ) : (
              <div className="mt-2 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-ink-faint">
                à annoter
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
