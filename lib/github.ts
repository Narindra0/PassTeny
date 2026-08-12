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
