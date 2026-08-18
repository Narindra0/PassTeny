'use client'

/**
 * Panneau « visiteur » après sélection d'un passage : à la place du formulaire
 * d'annotation, on propose une visu du passage (carte OG générée avec la
 * citation) + la suggestion de se connecter pour annoter.
 */
import { useState } from 'react'
import Link from 'next/link'

interface SelectionVisualProps {
  title: string
  artist: string
  quote: string
  cover?: string | null
  onClose: () => void
}

export default function SelectionVisual({ title, artist, quote, cover, onClose }: SelectionVisualProps) {
  const [copied, setCopied] = useState(false)

  const ogUrl = `/api/og?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(
    artist
  )}&quote=${encodeURIComponent(quote)}${cover ? `&cover=${encodeURIComponent(cover)}` : ''}`

  async function copyCard() {
    const full = new URL(ogUrl, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.open(full, '_blank')
    }
  }

  return (
    <div className="card fixed inset-x-0 bottom-0 z-40 m-4 rounded-2xl p-5 shadow-card sm:inset-x-auto sm:right-6 sm:bottom-6 sm:m-0 sm:w-[30rem] sm:rounded-lg">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-ink">Votre visuel du passage</h3>
          <blockquote className="mt-1 max-h-16 overflow-hidden border-l-[3px] border-mustard pl-2.5 text-xs italic leading-relaxed text-ink-soft">
            {quote}
          </blockquote>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>

      {/* La visu — carte OG générée avec le passage sélectionné (src dynamique, comme CoverImage) */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL dynamique /api/og, pas optimisable par next/image */}
      <img
        src={ogUrl}
        alt={`Carte visuelle du passage : ${quote}`}
        className="mt-1 w-full rounded-lg border border-line-strong object-cover shadow-soft"
      />

      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        Sélectionner, c&apos;est déjà composer. Connectez-vous pour ajouter l&apos;explication —
        en attendant, générez votre carte du passage.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/auth/signin"
          className="btn btn-primary btn-sm flex-1"
          style={{ minWidth: '10rem' }}
        >
          <i className="fa-solid fa-user" aria-hidden="true" /> Se connecter pour annoter
        </Link>
        <button type="button" onClick={copyCard} className="btn btn-secondary btn-sm">
          <i
            className={`${copied ? 'fa-solid fa-check text-green' : 'fa-regular fa-image text-red'} text-sm`}
            aria-hidden="true"
          />
          {copied ? 'Carte copiée' : 'Copier la carte'}
        </button>
        <a href={ogUrl} download="visu-passteny.png" className="btn btn-secondary btn-sm">
          <i className="fa-solid fa-download text-sm" aria-hidden="true" /> Télécharger
        </a>
      </div>
    </div>
  )
}
