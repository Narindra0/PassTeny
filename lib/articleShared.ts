/**
 * Types, constantes et helpers purs pour les articles.
 *
 * Ce fichier n'a AUCUNE dépendance server-only, il peut donc être
 * importé côté client (components 'use client') sans problème.
 */

export type ArticleCategory = 'journal' | 'analyse' | 'portrait' | 'réflexion' | 'guide'

export interface CommunityArticle {
  id: string
  authorId: string
  authorUsername?: string
  title: string
  subtitle?: string
  content: string
  coverUrl?: string
  category: ArticleCategory
  tags: string[]
  status: 'pending' | 'approved' | 'rejected'
  readTime?: string
  createdAt: string
  updatedAt: string
}

export const CATEGORY_LABELS: Record<ArticleCategory, { label: string; icon: string; color: string }> = {
  journal: { label: 'Journal', icon: 'fa-solid fa-book-open', color: 'text-red' },
  analyse: { label: 'Analyse', icon: 'fa-solid fa-magnifying-glass-chart', color: 'text-mustard-dark' },
  portrait: { label: 'Portrait', icon: 'fa-solid fa-microphone', color: 'text-green' },
  réflexion: { label: 'Réflexion', icon: 'fa-solid fa-brain', color: 'text-[#6A4C93]' },
  guide: { label: 'Guide', icon: 'fa-solid fa-compass', color: 'text-[#2A9D8F]' },
}

/** Estime le temps de lecture à partir du contenu (≈ 200 mots/min). */
export function estimateReadTime(content: string): string {
  const words = content.split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / 200))
  return `${minutes} min`
}
