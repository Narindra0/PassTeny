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
}

export default function ShareCard({ title, artist, quote }: ShareCardProps) {
  const [copied, setCopied] = useState(false)

  const url = () => {
    const base = window.location.origin
    const params = new URLSearchParams({ title, artist })
    if (quote) params.set('quote', quote)
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

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:border-amber-500 hover:text-amber-600 dark:border-zinc-700 dark:hover:text-amber-400"
      title="Copier l'URL de la carte partageable"
    >
      <span aria-hidden="true">🖼️</span>
      {copied ? 'Carte copiée ✓' : 'Carte partageable'}
    </button>
  )
}
