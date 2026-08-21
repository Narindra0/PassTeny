/**
 * Logique des badges de contribution — partagée entre server et client.
 * Les types et la fonction computeBadges vivent ici pour être importables
 * depuis les server components (pages) et les client components (rendering).
 */

export interface Badge {
  id: string
  icon: string
  label: string
  description: string
  color: 'red' | 'mustard' | 'green' | 'ink'
}

/** Définition de tous les badges possibles. */
export const ALL_BADGES: Badge[] = [
  { id: 'first_annotation', icon: 'fa-solid fa-seedling', label: 'Première plume', description: 'A publié sa première annotation', color: 'green' },
  { id: 'ten_annotations', icon: 'fa-solid fa-feather-pointed', label: 'Plume active', description: '10 annotations publiées', color: 'red' },
  { id: 'fifty_annotations', icon: 'fa-solid fa-book-open', label: 'Glossateur', description: '50 annotations publiées', color: 'red' },
  { id: 'top_contributor', icon: 'fa-solid fa-star', label: 'Étoile montante', description: '100+ points de réputation', color: 'mustard' },
  { id: 'legend', icon: 'fa-solid fa-crown', label: 'Légende', description: '500+ points de réputation', color: 'mustard' },
  { id: 'active_voter', icon: 'fa-solid fa-check-double', label: 'Jugé bon', description: '10+ votes émis', color: 'green' },
  { id: 'parolier', icon: 'fa-solid fa-music', label: 'Parolier', description: '5+ lyrics ajoutés au catalogue', color: 'red' },
  { id: 'trusted', icon: 'fa-solid fa-shield-halved', label: 'Contributeur de confiance', description: 'Rôle elevated par la communauté', color: 'mustard' },
  { id: 'moderator', icon: 'fa-solid fa-gavel', label: 'Modérateur', description: 'Gardien du catalogue', color: 'ink' },
]

/** Calcule les badges gagnés à partir des stats du contributeur. */
export function computeBadges(stats: {
  merged: number
  reputation: number
  votesCast: number
  lyricSuggestionsMerged: number
  role: string
}): Badge[] {
  const earned: Badge[] = []

  if (stats.merged >= 1) earned.push(ALL_BADGES[0])
  if (stats.merged >= 10) earned.push(ALL_BADGES[1])
  if (stats.merged >= 50) earned.push(ALL_BADGES[2])
  if (stats.reputation >= 100) earned.push(ALL_BADGES[3])
  if (stats.reputation >= 500) earned.push(ALL_BADGES[4])
  if (stats.votesCast >= 10) earned.push(ALL_BADGES[5])
  if (stats.lyricSuggestionsMerged >= 5) earned.push(ALL_BADGES[6])
  if (stats.role === 'trusted') earned.push(ALL_BADGES[7])
  if (stats.role === 'moderator') earned.push(ALL_BADGES[8])

  return earned
}
