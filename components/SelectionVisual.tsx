'use client'

/**
 * Panneau visiteur après sélection d'un passage :
 * Visu du passage (carte OG) + CTA pour se connecter.
 * Pas de punchline — il faut être connecté.
 */
import { useState } from 'react'
import { openSignIn } from '@/components/SignInModal'

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
    <div className="card fixed inset-x-0 bottom-0 z-40 m-4 overflow-hidden rounded-2xl shadow-card sm:inset-x-auto sm:right-6 sm:bottom-6 sm:m-0 sm:w-[30rem] sm:rounded-lg">
      {/* Header + citation */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <blockquote className="max-h-12 overflow-hidden border-l-[3px] border-mustard pl-2.5 text-xs italic leading-relaxed text-ink-soft">
            « {quote} »
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

      {/* Carte OG */}
      <div className="px-4 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL dynamique /api/og */}
        <img
          src={ogUrl}
          alt={`Carte visuelle du passage : ${quote}`}
          className="w-full rounded-lg border border-line-strong object-cover shadow-soft"
        />

        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          Sélectionner, c&apos;est déjà composer. Connectez-vous pour annoter
          ou proposer cette ligne comme punchline.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openSignIn}
            className="btn btn-primary btn-sm flex-1"
            style={{ minWidth: '10rem' }}
          >
            <i className="fa-solid fa-user" aria-hidden="true" /> Se connecter
          </button>
          <button type="button" onClick={copyCard} className="btn btn-secondary btn-sm">
            <i
              className={`${copied ? 'fa-solid fa-check text-green' : 'fa-regular fa-image text-red'} text-sm`}
              aria-hidden="true"
            />
            {copied ? 'Copiée' : 'Copier'}
          </button>
          <a href={ogUrl} download="visu-passteny.png" className="btn btn-secondary btn-sm">
            <i className="fa-solid fa-download text-sm" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  )
}
