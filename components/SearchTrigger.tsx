'use client'

/**
 * Bouton réutilisable qui ouvre la recherche en modal.
 * Utilisé dans le header (icône loupe), le hero (fausse barre de recherche),
 * le footer et le « Tout voir » du chart.
 */
import type { ReactNode } from 'react'
import { openSearch } from './SearchModal'

interface SearchTriggerProps {
  label: string
  className?: string
  children: ReactNode
}

export default function SearchTrigger({ label, className = '', children }: SearchTriggerProps) {
  return (
    <button type="button" onClick={openSearch} aria-label={label} className={className}>
      {children}
    </button>
  )
}
