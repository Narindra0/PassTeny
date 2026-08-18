/**
 * Client GitHub (Octokit) — réservé au serveur.
 *
 * Phase 1 : ouverture et merge automatique des Pull Requests sur le repo
 * content `pass-teny-content` (annotations validées → contenu canon).
 * Phase 0 : fournit un client initialisé si `GITHUB_TOKEN` est présent,
 * sinon des helpers qui échouent avec un message explicite.
 */
import 'server-only'
import { Octokit } from '@octokit/rest'
import { config } from '@/lib/config'

export function getOctokit(): Octokit {
  if (!config.githubToken) {
    throw new Error(
      'GITHUB_TOKEN manquant : ajoutez-le dans .env.local pour utiliser le pipeline GitHub (phase 1).',
    )
  }
  return new Octokit({ auth: config.githubToken })
}

/** Retourne le repo content sous forme {owner, repo}. */
export function contentRepo() {
  const [owner, repo] = config.contentRepo.split('/')
  if (!owner || !repo) throw new Error(`CONTENT_REPO invalide : ${config.contentRepo}`)
  return { owner, repo, branch: config.contentBranch }
}

export interface AnnotationChange {
  artistSlug: string
  songSlug: string
  /** Nouveau contenu complet du fichier annotations.json. */
  annotationsJson: string
  commitMessage: string
}

/** Structure du fichier racine `index.json` du repo content. */
interface ContentIndex {
  artists: { slug: string; name: string; coverUrl?: string }[]
  songs: { slug: string; artistSlug: string; artist: string; title: string; album: string; coverUrl?: string }[]
}

/** Slug d'un titre/artiste (même règle que le seed). */
export function slugifyContent(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** LRC → texte brut (supprime les horodatages [mm:ss.xx]). */
export function lrcToPlainText(lrc: string): string {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const text = raw.replace(/^\[[^\]]*\](?:\s*\[[^\]]*\])*/g, '').trim()
    if (!text) continue
    if (seen.has(text)) continue
    seen.add(text)
    lines.push(text)
  }
  return lines.join('\n')
}

export interface NewSongChange {
  artistSlug: string
  songSlug: string
  artistName: string
  title: string
  album?: string | null
  coverUrl?: string | null
  passioAlbumId?: string | null
  passioTrackId?: string | null
  lyrics: string
  lyricsFormat: 'lrc' | 'txt'
  commitMessage: string
}

/**
 * Ajout d'un nouveau titre au repo content : crée le dossier du titre
 * (meta.json, lyrics.lrc ou lyrics.txt, annotations.json) et met à jour
 * `index.json` pour que le titre apparaisse sur le site après le merge.
 * Retourne le numéro et l'URL de la PR.
 */
export async function openNewSongPr(change: NewSongChange): Promise<{ number: number; url: string }> {
  const octokit = getOctokit()
  const { owner, repo, branch } = contentRepo()
  const baseDir = `${change.artistSlug}/${change.songSlug}`

  // ── index.json actuel (existant ou vide) ──
  let index: ContentIndex = { artists: [], songs: [] }
  let indexSha: string | undefined
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path: 'index.json', ref: branch })
    if (Array.isArray(existing.data) || existing.data.type !== 'file') {
      throw new Error(`Chemin inattendu : index.json`)
    }
    index = JSON.parse(Buffer.from(existing.data.content, 'base64').toString('utf8')) as ContentIndex
    indexSha = existing.data.sha
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err
  }

  // ── Déduplication du slug si le titre existe déjà ──
  let songSlug = change.songSlug
  let n = 2
  while (index.songs.some((s) => s.artistSlug === change.artistSlug && s.slug === songSlug)) {
    songSlug = `${change.songSlug}-${n++}`
  }

  // ── Artiste : ajout à l'index si nouveau ──
  if (!index.artists.some((a) => a.slug === change.artistSlug)) {
    index.artists.push({
      slug: change.artistSlug,
      name: change.artistName,
      ...(change.coverUrl ? { coverUrl: change.coverUrl } : {}),
    })
  }
  index.songs.push({
    slug: songSlug,
    artistSlug: change.artistSlug,
    artist: change.artistName,
    title: change.title,
    album: change.album ?? '',
    ...(change.coverUrl ? { coverUrl: change.coverUrl } : {}),
  })

  const meta = {
    id: songSlug,
    title: change.title,
    artist: change.artistName,
    artists: [change.artistName],
    album: change.album ?? '',
    albumSlug: change.album ? slugifyContent(`${change.artistSlug}--${change.album}`) : undefined,
    coverUrl: change.coverUrl ?? undefined,
    language: [],
    tags: [],
    source: {
      platform: 'passio',
      albumId: change.passioAlbumId ?? undefined,
      trackId: change.passioTrackId ?? undefined,
      albumTitle: change.album ?? undefined,
      note: 'Soumission communautaire',
    },
    addedAt: new Date().toISOString().slice(0, 10),
  }

  // ── Fichiers du titre ──
  const files: { path: string; content: string }[] = [
    {
      path: `${baseDir}/meta.json`,
      content: JSON.stringify(meta, null, 2) + '\n',
    },
    {
      path: `${baseDir}/annotations.json`,
      content: JSON.stringify({ annotations: [] }, null, 2) + '\n',
    },
  ]
  if (change.lyricsFormat === 'lrc') {
    files.push(
      { path: `${baseDir}/lyrics.lrc`, content: change.lyrics.replace(/\r\n/g, '\n') + '\n' },
      { path: `${baseDir}/lyrics.txt`, content: lrcToPlainText(change.lyrics).replace(/\r\n/g, '\n') + '\n' },
    )
  } else {
    files.push({ path: `${baseDir}/lyrics.txt`, content: change.lyrics.replace(/\r\n/g, '\n') + '\n' })
  }
  files.push({
    path: 'index.json',
    content: JSON.stringify(index, null, 2) + '\n',
  })

  // ── Branche + écriture + PR ──
  const head = `teny-new-song-${Date.now().toString(36)}`
  const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${head}`, sha: baseRef.data.object.sha })

  for (const file of files) {
    let existingSha: string | undefined
    if (file.path === 'index.json') existingSha = indexSha
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: change.commitMessage,
      content: Buffer.from(file.content).toString('base64'),
      branch: head,
      ...(existingSha ? { sha: existingSha } : {}),
    })
  }

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title: change.commitMessage,
    head,
    base: branch,
    body: `Soumission communautaire Pass'Teny — nouveau titre « ${change.title} » (${change.artistName}).\n\nLyrics ajoutés en ${change.lyricsFormat.toUpperCase()}. À valider puis merger pour publication.`,
  })

  return { number: pr.data.number, url: pr.data.html_url }
}

/**
 * Publication **directe** sur la branche principale (mode « tout auto ») :
 * crée le dossier du titre (meta.json, lyrics, annotations.json) et met à
 * jour `index.json`. Pas de PR — le contenu est en ligne immédiatement.
 *
 * Doit être appelé de façon sérialisée (voir lib/publish.ts) : chaque appel
 * relit `index.json` fraîchement, donc jamais de conflit de merge.
 */
export async function commitNewSongToMain(change: NewSongChange): Promise<{ commitSha: string; commitUrl: string }> {
  const octokit = getOctokit()
  const { owner, repo, branch } = contentRepo()
  const baseDir = `${change.artistSlug}/${change.songSlug}`

  // ── index.json actuel (existant ou vide) ──
  let index: ContentIndex = { artists: [], songs: [] }
  let indexSha: string | undefined
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path: 'index.json', ref: branch })
    if (Array.isArray(existing.data) || existing.data.type !== 'file') {
      throw new Error(`Chemin inattendu : index.json`)
    }
    index = JSON.parse(Buffer.from(existing.data.content, 'base64').toString('utf8')) as ContentIndex
    indexSha = existing.data.sha
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err
  }

  // ── Déduplication du slug si le titre existe déjà ──
  let songSlug = change.songSlug
  let n = 2
  while (index.songs.some((s) => s.artistSlug === change.artistSlug && s.slug === songSlug)) {
    songSlug = `${change.songSlug}-${n++}`
  }

  if (!index.artists.some((a) => a.slug === change.artistSlug)) {
    index.artists.push({
      slug: change.artistSlug,
      name: change.artistName,
      ...(change.coverUrl ? { coverUrl: change.coverUrl } : {}),
    })
  }
  index.songs.push({
    slug: songSlug,
    artistSlug: change.artistSlug,
    artist: change.artistName,
    title: change.title,
    album: change.album ?? '',
    ...(change.coverUrl ? { coverUrl: change.coverUrl } : {}),
  })

  const meta = {
    id: songSlug,
    title: change.title,
    artist: change.artistName,
    artists: [change.artistName],
    album: change.album ?? '',
    albumSlug: change.album ? slugifyContent(`${change.artistSlug}--${change.album}`) : undefined,
    coverUrl: change.coverUrl ?? undefined,
    language: [],
    tags: [],
    source: {
      platform: 'passio',
      albumId: change.passioAlbumId ?? undefined,
      trackId: change.passioTrackId ?? undefined,
      albumTitle: change.album ?? undefined,
      note: 'Soumission communautaire',
    },
    addedAt: new Date().toISOString().slice(0, 10),
  }

  const files: { path: string; content: string }[] = [
    { path: `${baseDir}/meta.json`, content: JSON.stringify(meta, null, 2) + '\n' },
    { path: `${baseDir}/annotations.json`, content: JSON.stringify({ annotations: [] }, null, 2) + '\n' },
  ]
  if (change.lyricsFormat === 'lrc') {
    files.push(
      { path: `${baseDir}/lyrics.lrc`, content: change.lyrics.replace(/\r\n/g, '\n') + '\n' },
      { path: `${baseDir}/lyrics.txt`, content: lrcToPlainText(change.lyrics).replace(/\r\n/g, '\n') + '\n' },
    )
  } else {
    files.push({ path: `${baseDir}/lyrics.txt`, content: change.lyrics.replace(/\r\n/g, '\n') + '\n' })
  }
  files.push({ path: 'index.json', content: JSON.stringify(index, null, 2) + '\n' })

  // ── Écriture séquentielle sur la branche principale ──
  let lastSha = ''
  for (const file of files) {
    let existingSha: string | undefined
    if (file.path === 'index.json') existingSha = indexSha
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: change.commitMessage,
      content: Buffer.from(file.content).toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    })
    lastSha = data.commit?.sha ?? lastSha
  }

  return { commitSha: lastSha, commitUrl: `https://github.com/${owner}/${repo}/commit/${lastSha}` }
}

/**
 * Ouvre une PR sur le repo content avec le nouveau `annotations.json`.
 * (Phase 1 — le merge est ensuite effectué par un modérateur ou en auto.)
 */
export async function openContentPr(change: AnnotationChange): Promise<{ number: number; url: string }> {
  const octokit = getOctokit()
  const { owner, repo, branch } = contentRepo()
  const path = `${change.artistSlug}/${change.songSlug}/annotations.json`
  const head = `teny-annotations-${Date.now().toString(36)}`

  const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${head}`,
    sha: baseRef.data.object.sha,
  })

  // Le fichier existe déjà (seed) : `createOrUpdateFileContents` exige son sha.
  let existingSha: string | undefined
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path, ref: branch })
    if (Array.isArray(existing.data)) {
      throw new Error(`Chemin inattendu (dossier ?) : ${path}`)
    }
    existingSha = existing.data.sha
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: change.commitMessage,
    content: Buffer.from(change.annotationsJson).toString('base64'),
    branch: head,
    ...(existingSha ? { sha: existingSha } : {}),
  })

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title: change.commitMessage,
    head,
    base: branch,
    body: `Contribution Pass'Teny — mise à jour automatique des annotations de \`${change.songSlug}\`.`,
  })

  return { number: pr.data.number, url: pr.data.html_url }
}
