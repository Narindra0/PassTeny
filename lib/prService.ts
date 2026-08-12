/**
 * Pipeline de contribution → contenu canon (repo `pass-teny-content`).
 *
 * 1. Charger le `annotations.json` canon du titre (GitHub raw).
 * 2. Fusionner les annotations validées (`mergeAnnotations`).
 * 3. Ouvrir une Pull Request via Octokit.
 * 4. Auto-merge si l'auteur a assez de PR mergées (réglage `auto_merge`).
 */
import { getCanonicalAnnotations } from '@/lib/content/source'
import { mergeAnnotations } from '@/lib/content/annotations'
import { openContentPr } from '@/lib/github'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { config } from '@/lib/config'
import { Octokit } from '@octokit/rest'
import type { Annotation } from '@/lib/types'

interface PrCandidate {
  songId: string
  artistSlug: string
  /** Ids Supabase des annotations à publier (pour le marquage de statut). */
  annotationIds: string[]
  annotations: Annotation[]
}

interface PipelineSettings {
  auto_pr: { min_net_votes: number }
  auto_merge: { enabled: boolean; author_min_merged: number }
}

/** Récupère la configuration auto_pr / auto_merge depuis `settings`. */
async function getPipelineSettings(): Promise<PipelineSettings> {
  const defaults: PipelineSettings = {
    auto_pr: { min_net_votes: 3 },
    auto_merge: { enabled: true, author_min_merged: 5 },
  }
  const admin = getSupabaseAdmin()
  if (!admin) return defaults
  const { data } = await admin.from('settings').select('key, value').in('key', ['auto_pr', 'auto_merge'])
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, unknown>
  return {
    auto_pr: { ...defaults.auto_pr, ...((map.auto_pr ?? {}) as object) },
    auto_merge: { ...defaults.auto_merge, ...((map.auto_merge ?? {}) as object) },
  }
}

/**
 * Ouvre (et éventuellement merge) la PR d'un lot d'annotations validées.
 * Retourne le statut final du pipeline.
 */
export async function publishAnnotations(candidate: PrCandidate): Promise<{
  outcome: 'opened' | 'merged' | 'skipped'
  prNumber?: number
  prUrl?: string
}> {
  const admin = getSupabaseAdmin()
  if (!admin) return { outcome: 'skipped' }
  const settings = await getPipelineSettings()

  const canonical = await getCanonicalAnnotations(candidate.artistSlug, candidate.songId)
  const { merged, added } = mergeAnnotations(canonical.annotations, candidate.annotations)
  if (added === 0) return { outcome: 'skipped' }

  const annotationsJson = JSON.stringify(
    { language: canonical.language, annotations: merged },
    null,
    2,
  ) + '\n'

  const { number, url } = await openContentPr({
    artistSlug: candidate.artistSlug,
    songSlug: candidate.songId,
    annotationsJson,
    commitMessage: `Annotations de ${candidate.songId} (${added} nouvelle${added > 1 ? 's' : ''})`,
  })

  // Marquage `approved` (PR ouverte, en attente de merge).
  await admin
    .from('annotations')
    .update({ status: 'approved', pr_number: number })
    .in('id', candidate.annotationIds)
    .in('status', ['pending'])

  // Auto-merge si l'auteur a déjà ≥ author_min_merged PR mergées.
  const autoMerge = settings.auto_merge
  const authorIds = [...new Set(candidate.annotations.map((a) => a.authorId ?? ''))].filter(Boolean)
  let mergedPr = false
  if (autoMerge.enabled && authorIds.length === 1 && config.githubToken) {
    const { count } = await admin
      .from('annotations')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', authorIds[0])
      .eq('status', 'merged')
    if ((count ?? 0) >= autoMerge.author_min_merged) {
      mergedPr = await tryMergePr(number)
    }
  }

  if (mergedPr) {
    return { outcome: 'merged', prNumber: number, prUrl: url }
  }
  return { outcome: 'opened', prNumber: number, prUrl: url }
}

/** Tente le merge de la PR ; silencieux en cas d'échec (revue requise). */
async function tryMergePr(prNumber: number): Promise<boolean> {
  try {
    const [owner, repo] = config.contentRepo.split('/')
    const octokit = new Octokit({ auth: config.githubToken })
    const res = await octokit.pulls.merge({ owner, repo, pull_number: prNumber, merge_method: 'squash' })
    return res.data.merged === true
  } catch {
    return false
  }
}
