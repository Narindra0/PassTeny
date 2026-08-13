/**
 * Pass'Teny — Modèle de contenu.
 *
 * Le contenu canon (lyrics + annotations validées) vit dans le repo Git public
 * `pass-teny-content` (miroir local dans `content/` en développement).
 * Ces types reflètent exactement le format des fichiers du repo.
 */

/** Référence vers l'origine du titre (seed initial depuis le catalogue Pass'io). */
export interface ContentSource {
  platform: 'passio'
  albumId?: string
  trackId?: string
  albumTitle?: string
  note?: string
}

/** `meta.json` — métadonnées d'un titre. */
export interface SongMeta {
  /** Slug unique du titre (identifiant stable). */
  id: string
  title: string
  /** Artiste principal. */
  artist: string
  /** Tous les artistes (feats inclus). */
  artists: string[]
  album: string
  albumSlug?: string
  releaseDate?: string
  coverUrl?: string
  producer?: string
  /** Langues des lyrics, ex. ["mg", "fr"]. */
  language?: string[]
  tags?: string[]
  /** Attribution automatique lors du seed depuis Pass'io. */
  source?: ContentSource
  addedAt?: string
}

/** Une annotation (offset caractères dans `lyrics.txt`). */
export interface Annotation {
  id: string
  /** Offset de début dans lyrics.txt (inclus). */
  start: number
  /** Offset de fin dans lyrics.txt (exclus). */
  end: number
  /** Copie exacte du passage annoté (pour vérification/rendu). */
  quote: string
  /** Explication du sens, du contexte, de la référence culturelle… */
  body: string
  tags?: string[]
  /** GitHub handle de l'auteur. */
  author: string
  createdAt?: string
  updatedAt?: string
  /** Id du profil auteur (usage serveur : pipeline PR, réputation). */
  authorId?: string
}

/** `annotations.json` — ensemble des annotations validées d'un titre. */
export interface AnnotationsFile {
  language?: string
  annotations: Annotation[]
}

/** Artiste tel que dérivé du repo content. */
export interface ArtistSummary {
  slug: string
  name: string
  songCount: number
  coverUrl?: string
}

/** Résumé d'un titre pour les listes. */
export interface SongSummary {
  slug: string
  artistSlug: string
  title: string
  artist: string
  album: string
  coverUrl?: string
  releaseDate?: string
  annotationCount: number
  language?: string[]
}

/** Titre complet chargé (lyrics + annotations). */
export interface Song extends SongSummary {
  meta: SongMeta
  /** Paroles brutes, sans timestamps (généré depuis le .lrc). */
  lyrics: string
  /** Paroles synchronisées au format LRC (si disponible). */
  lrc?: string
  annotations: Annotation[]
}
