/**
 * Contenu éditorial Pass'Teny — Magazine, Wallpapers, Actualités.
 *
 * Les articles du magazine sont écrits à la main par l'équipe.
 * Les wallpapers et actualités restent générés dynamiquement
 * car ils dépendent du contenu vivant du catalogue.
 */
import { listSongs, listAlbums } from '@/lib/content/source'
import { getTopContributors, getTotalViews } from '@/lib/views'
import { listTopPunchlines } from '@/lib/punchlines'

// ── Types ────────────────────────────────────────────────────────────────

export type ArticleCategory = 'portrait' | 'analyse' | 'communauté' | 'édito' | 'culture'

export interface MagazineArticle {
  slug: string
  title: string
  subtitle: string
  category: ArticleCategory
  coverUrl?: string | null
  readTime: string
  excerpt: string
  /** Contenu complet de l'article (Markdown brut) */
  content: string
  /** Auteur de l'article */
  author: string
  /** Date de publication */
  date: string
  /** Tags optionnels */
  tags?: string[]
  /** Lien externe optionnel (vers un titre, un artiste…) */
  href?: string
}

export interface Wallpaper {
  id: string
  title: string
  artist: string
  coverUrl?: string | null
  quote: string
  style: 'dark' | 'light' | 'vintage' | 'neon'
  accent: string
}

export interface NewsItem {
  id: string
  type: 'annotation' | 'contributor' | 'release' | 'punchline'
  title: string
  description: string
  date: string
  link?: string
  meta?: {
    songTitle?: string
    artistName?: string
    username?: string
    count?: number
  }
}

// ── Magazine — Articles écrits par l'équipe ──────────────────────────────

/**
 * Les articles du magazine Pass'Teny.
 * Écrits à la main — chaque article a un vrai contenu éditorial.
 *
 * Pour ajouter un article :
 * 1. Ajoutez un objet dans le tableau `MAGAZINE_ARTICLES`
 * 2. Remplissez le champ `content` avec le Markdown de l'article
 * 3. L'article apparaît automatiquement sur /magazine
 */
const MAGAZINE_ARTICLES: MagazineArticle[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ÉDITO
  // ══════════════════════════════════════════════════════════════════════
  {
    slug: 'bienvenue-pass-teny',
    title: 'Bienvenue sur Pass\'Teny',
    subtitle: 'Pourquoi ce projet existe',
    category: 'édito',
    readTime: '3 min',
    excerpt: 'Pass\'Teny n\'est pas juste un site de lyrics. C\'est un outil de compréhension culturelle — chaque parole malgache mérite d\'être expliquée, débattue, transmise.',
    author: 'Équipe Pass\'Teny',
    date: '2025',
    tags: ['édito', 'lancement'],
    content: `Pass'Teny, c'est l'idée simple que chaque parole malgache raconte une histoire qui va au-delà du sens littéral.

Quand un artiste malgache écrit *« Tsy mahalana-bavana isaky ny miteny »*, il ne parle pas juste de la parole — il invoque un ohabolana ancestral sur le respect de la communication. Sans annotations, cette couche de sens se perd pour celui qui n'a pas grandi avec la culture.

## Le problème

Les plateformes de lyrics existent partout. Genius l'a démocratisé pour l'anglais. Mais pour les langues malgaches — le malgache, le tsihisy, le sakalava — il n'existe rien de comparable.

Le résultat ? Des millions de jeunes Malgaches écoutent de la musique dont ils ne comprennent pas toutes les nuances. Les ohabolana, les métaphores, les références culturelles passent inaperçues.

## Notre approche

Pass'Teny fonctionne comme un dictionnaire vivant, construit par la communauté :

1. **Sélectionnez** un passage de lyrics
2. **Expliquez** son sens, son contexte, sa référence culturelle
3. **La communauté valide** — les meilleures explications rejoignent le canon

Ce n'est pas un wiki. C'est un processus curationné : chaque annotation passe par une validation avant de devenir définitive.

## Ce qui vient

Le magazine que vous lisez est le début d'une couche éditoriale plus large — portraits d'artistes, analyses de paroles, décryptage de la scène musicale malgache.

Bienvenue dans le catalogue.`,
  },

  // ══════════════════════════════════════════════════════════════════════
  // PORTRAITS
  // ══════════════════════════════════════════════════════════════════════
  {
    slug: 'portrait-scene-malgache',
    title: 'La scène musicale malgache en 2025',
    subtitle: 'Un aperçu de ce qui bouge',
    category: 'portrait',
    readTime: '5 min',
    excerpt: 'De la rap game aux racines folk, la scène musicale malgache n\'a jamais été aussi diverse. Tour d\'horizon des voix qui comptent.',
    author: 'Équipe Pass\'Teny',
    date: '2025',
    tags: ['scène', 'portrait', 'malgache'],
    content: `La scène musicale malgache traverse une ère d'or silencieuse. Loin des projecteurs internationaux, une génération d'artistes construit un son unique — ancré dans la tradition, tourné vers le futur.

## Le rap malgache : au-delà des clôtures

Le rap malgache a longtemps vécu dans l'ombre du rap français. Aujourd'hui, il a trouvé sa voix propre. Des artistes comme les pionniers du genre ont ouvert la voie, mais c'est la nouvelle génération qui redéfinit les codes.

Les textes ne parlent plus seulement de la rue — ils parlent de la *fomba* (les coutumes), de la *fihavanana* (la solidarité), de la tension entre tradition et modernité. Le rap malgache est devenu un espace de réflexion culturelle.

## Les voix féminines

Un mouvement croissant de femmes artistes reprend le micro. Elles parlent de l'identité féminine malgache, des défis sociaux, de la place de la femme dans la société — avec une franchise qui force le respect.

## La folk revisitée

Le *kabosy*, la *valiha*, les rythmes traditionnels ne sont plus réservés aux musiciens de chars. De jeunes artistes les infusent dans des productions modernes — électro-folk, hip-hop acoustique, fusion jazz.

## Pourquoi Pass'Teny ?

Parce que cette musique mérite d'être comprise. Pas juste écoutée, pas juste likingée — *comprise*. Chaque parole a un poids culturel. Chaque ohabolana cité dans un rap porte des siècles de sagesse.

C'est ça, le projet Pass'Teny.`,
  },

  // ══════════════════════════════════════════════════════════════════════
  // ANALYSES
  // ══════════════════════════════════════════════════════════════════════
  {
    slug: 'comprendre-ohabolana-lyrics',
    title: 'Comment un ohabolana change le sens d\'une chanson',
    subtitle: 'L\'art de citer la sagesse ancestrale dans la musique moderne',
    category: 'analyse',
    readTime: '4 min',
    excerpt: 'Quand un artiste malgache glisse un ohabolana dans ses lyrics, il ne fait pas juste rimé — il active des siècles de sagesse. Voici comment le décoder.',
    author: 'Équipe Pass\'Teny',
    date: '2025',
    tags: ['ohabolana', 'analyse', 'culture'],
    content: `Un ohabolana, c'est un proverbe malgache. Mais dans la bouche d'un artiste, c'est bien plus qu'une citation — c'est un raccourci culturel qui condense tout un système de pensée en une phrase.

## Le mécanisme

Quand un rappeur dit *« Ny firaisana no iainana »* (L'union, c'est la vie), il ne dit pas juste « il faut être unis ». Il invoque :

- Un **principe social** : la *fihavanana* (solidarité) comme pilier de la société malgache
- Une **référence intergénérationnelle** : cet ohabolana se transmet de mère en fils depuis des siècles
- Une **résonance émotionnelle** : pour un auditeur malgache, ces mots réveillent des souvenirs d'enfance, des voix de grands-parents

## Pourquoi c'est difficile à traduire

La traduction littérale perd 90% du sens. *« Ny aza-misy no tobim-bahoaka »* — littéralement « ce que personne ne veut, c'est le peuple entier ». En réalité, cela exprime l'idée que la décision collective prime sur les intérêts individuels.

Sur Pass'Teny, nous annotons ces passages pour préserver cette richesse.

## Comment contribuer

Si vous connaissez le sens d'un ohabolana utilisé dans une chanson, vous pouvez l'annoter directement sur Pass'Teny. Sélectionnez le passage, expliquez-le, et la communauté validait votre explication.

C'est ainsi que le catalogue s'enrichit — parole par parole.`,
  },

  // ══════════════════════════════════════════════════════════════════════
  // COMMUNAUTÉ
  // ══════════════════════════════════════════════════════════════════════
  {
    slug: 'annoter-culture-malgache',
    title: 'Annoter, c\'est préserver',
    subtitle: 'Comment la communauté Pass\'Teny construit un dictionnaire vivant',
    category: 'communauté',
    readTime: '4 min',
    excerpt: 'Chaque annotation publiée sur Pass\'Teny est un acte de préservation culturelle. La communauté ne commente pas — elle documente, explique, transmet.',
    author: 'Équipe Pass\'Teny',
    date: '2025',
    tags: ['communauté', 'annotation', 'culture'],
    content: `Quand quelqu'un prend 5 minutes pour expliquer le sens d'un passage de lyrics sur Pass'Teny, il ne fait pas juste « du contenu ». Il participe à un travail de documentation culturelle.

## Le problème de la transmission

Les ohabolana, les expressions idiomatiques, les références culturelles malgaches se transmettent oralement. Quand un grand-père meurt sans avoir raconté l'histoire derrière un ohabolana, cette connaissance meurt avec lui.

La musique malgache est l'un des derniers véhicules de cette transmission orale. Mais sans annotations, le message passe inaperçu pour ceux qui n'ont pas le contexte.

## Notre rôle

Pass'Teny crée un pont entre :

- **Ceux qui savent** — les personnes qui grandissent avec la culture, qui comprennent les nuances
- **Ceux qui veulent comprendre** — les jeunes Malgaches de la diaspora, les étrangers curieux, les étudiants

Chaque annotation est un petit acte de résistance contre l'oubli.

## Comment ça marche

1. **Sélectionnez** un passage dans les lyrics
2. **Écrivez** votre explication — contexte, sens, référence culturelle
3. **Soumettez** — la communauté vote, les meilleures annotations sont validées
4. **Le canon grandit** — l'annotation rejoint le contenu définitif du titre

C'est un travail collectif. Et c'est en cours.`,
  },

  // ══════════════════════════════════════════════════════════════════════
  // CULTURE
  // ══════════════════════════════════════════════════════════════════════
  {
    slug: 'malgache-langue-rythmee',
    title: 'Le malgache, langue naturellement rythmée',
    subtitle: 'Pourquoi la musique malgache sonne autrement',
    category: 'culture',
    readTime: '3 min',
    excerpt: 'La langue malgache a un rythme naturel — les voyelles, les assonances, la structure des phrases — qui influence directement la musique qui en découle.',
    author: 'Équipe Pass\'Teny',
    date: '2025',
    tags: ['langue', 'culture', 'musique'],
    content: `Le malgache est une langue austronésienne. Sa structure est unique en Afrique — et cette singularité se reflète dans la musique.

## Le poids des voyelles

En malgache, les mots se terminent presque toujours par une voyelle. Cette particularité crée un flux sonore continu, presque chanté, même dans la conversation quotidienne.

Quand un artiste rappe en malgache, il bénéficie de cet avantage naturel : les mots s'enchaînent avec une fluidité que les langues consonantiques ne permettent pas.

## L'assonance comme outil

La poésie malgache traditionnelle repose sur l'assonance — la répétition de sons voyelles. Cette technique se retrouve directement dans les lyrics modernes :

- Les rimes internes (pas seulement en fin de vers)
- Les jeux de mots phonétiques
- Les refrains à base de répétitions vocaliques

## La mère des mots

Le malgache a un vocabulaire riche pour exprimer les nuances émotionnelles. Un seul mot peut porter trois sens selon le contexte — ce qui donne aux paroliers une palette d'expression extraordinaire.

C'est cette richesse que Pass'Teny cherche à documenter, annotation par annotation.`,
  },
]

/** Récupère tous les articles éditoriaux. */
export function listMagazineArticles(): MagazineArticle[] {
  return MAGAZINE_ARTICLES
}

/** Récupère un article par son slug. */
export function getMagazineArticle(slug: string): MagazineArticle | undefined {
  return MAGAZINE_ARTICLES.find((a) => a.slug === slug)
}

// ── Wallpapers ───────────────────────────────────────────────────────────

export async function listWallpapers(): Promise<Wallpaper[]> {
  const [songs, punchlines] = await Promise.all([
    listSongs(),
    listTopPunchlines(20),
  ])

  const wallpapers: Wallpaper[] = []
  const styles: Wallpaper['style'][] = ['dark', 'light', 'vintage', 'neon']
  const accents = ['#E63946', '#FFB703', '#2A9D8F', '#6A4C93', '#F4A261', '#264653']

  for (let i = 0; i < Math.min(punchlines.length, 12); i++) {
    const p = punchlines[i]
    wallpapers.push({
      id: `wp-punchline-${i}`,
      title: p.songTitle,
      artist: p.artistName,
      coverUrl: songs.find((s) => s.slug === p.songId)?.coverUrl,
      quote: p.quote,
      style: styles[i % styles.length],
      accent: accents[i % accents.length],
    })
  }

  const topSongs = [...songs]
    .sort((a, b) => b.annotationCount - a.annotationCount)
    .slice(0, 6)

  for (let i = 0; i < topSongs.length; i++) {
    const s = topSongs[i]
    if (wallpapers.some((w) => w.title === s.title && w.artist === s.artist)) continue
    wallpapers.push({
      id: `wp-song-${i}`,
      title: s.title,
      artist: s.artist,
      coverUrl: s.coverUrl,
      quote: s.title,
      style: styles[(i + 2) % styles.length],
      accent: accents[(i + 2) % accents.length],
    })
  }

  return wallpapers
}

// ── Actualités ───────────────────────────────────────────────────────────

export async function listRecentNews(limit = 8): Promise<NewsItem[]> {
  const [songs, albums, annotators, totalViews, punchlines] = await Promise.all([
    listSongs(),
    listAlbums(),
    getTopContributors(5),
    getTotalViews(),
    listTopPunchlines(3),
  ])

  const news: NewsItem[] = []

  for (const album of albums.slice(0, 3)) {
    news.push({
      id: `release-${album.slug}`,
      type: 'release',
      title: `Nouveau : « ${album.album} » de ${album.artist}`,
      description: `${album.trackCount} titre${album.trackCount > 1 ? 's' : ''} ajouté${album.trackCount > 1 ? 's' : ''} au catalogue`,
      date: 'Récemment',
      link: `/albums/${album.slug}`,
      meta: { songTitle: album.album, artistName: album.artist, count: album.trackCount },
    })
  }

  for (const c of annotators.slice(0, 3)) {
    news.push({
      id: `contributor-${c.id}`,
      type: 'contributor',
      title: `${c.username} a contribué`,
      description: `${c.mergedAnnotations} annotation${c.mergedAnnotations > 1 ? 's' : ''} publiée${c.mergedAnnotations > 1 ? 's' : ''} · ${c.reputation} points`,
      date: 'Récemment',
      link: `/contributors/${c.username}`,
      meta: { username: c.username, count: c.mergedAnnotations },
    })
  }

  for (const p of punchlines.slice(0, 2)) {
    news.push({
      id: `punchline-${p.id}`,
      type: 'punchline',
      title: `Punchline votée : « ${p.quote.slice(0, 40)}${p.quote.length > 40 ? '…' : ''} »`,
      description: `${p.score > 0 ? '+' : ''}${p.score} votes · par @${p.author}`,
      date: 'Récemment',
      link: `/songs/${p.songId}`,
      meta: { songTitle: p.songTitle, artistName: p.artistName, username: p.author, count: p.score },
    })
  }

  const annotatedCount = songs.filter((s) => s.annotationCount > 0).length
  news.push({
    id: 'stats-global',
    type: 'annotation',
    title: `${annotatedCount} titre${annotatedCount > 1 ? 's' : ''} annoté${annotatedCount > 1 ? 's' : ''} au total`,
    description: `${songs.length} titres au catalogue · ${totalViews.toLocaleString('fr-FR')} vues cumulées`,
    date: 'En cours',
    link: '/chart',
    meta: { count: annotatedCount },
  })

  return news.slice(0, limit)
}
