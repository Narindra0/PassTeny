'use client'

/**
 * Bouton « Carte partageable » : génère l'URL de la carte OG statique
 * (/api/og) avec titre, artiste et citation, et la copie pour partage
 * (Stories Instagram/Facebook, réseaux).
 */
import { useState } from 'react'

interface ShareCardProps {
  title: string
  artist: string
  quote?: string
  cover?: string | null
  /** Variante pour fond sombre (hero de la page titre). */
  variant?: 'light' | 'on-dark'
}

export default function ShareCard({ title, artist, quote, cover, variant = 'light' }: ShareCardProps) {
  const [copied, setCopied] = useState(false)

  const url = () => {
    const base = window.location.origin
    const params = new URLSearchParams({ title, artist })
    if (quote) params.set('quote', quote)
    if (cover) params.set('cover', cover)
    return `${base}/api/og?${params.toString()}`
  }

  async function handleShare() {
    const shareUrl = url()
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.open(shareUrl, '_blank')
    }
  }

  const onDark = variant === 'on-dark'
  const buttonClass = onDark
    ? 'group inline-flex items-center gap-2 rounded-full border border-paper/40 bg-transparent px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-paper transition-all hover:-translate-y-0.5 hover:border-white hover:bg-white hover:text-ink'
    : 'group inline-flex items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink shadow-soft transition-all hover:-translate-y-0.5 hover:border-lamba-red hover:bg-lamba-red hover:text-white hover:shadow-lift'
  const iconClass = `fa-${copied ? 'solid fa-check' : 'regular fa-image'} text-sm ${
    onDark ? 'text-red-light transition-colors group-hover:text-red' : 'text-red transition-colors group-hover:text-white'
  }`
  const label = copied ? 'Carte copiée' : 'Carte partageable'

  return (
    <button
      type="button"
      onClick={handleShare}
      className={buttonClass}
      title="Copier l'URL de la carte partageable"
    >
      <i aria-hidden="true" className={iconClass} />
      {label}
    </button>
  )
}
