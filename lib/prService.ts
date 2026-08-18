/**
 * Pipeline de contribution → contenu canon (repo `pass-teny-content`).
 *
 * 1. Charger le `annotations.json` canon du titre (GitHub raw).
 * 2. Fusionner les annotations validées (`mergeAnnotations`).
 * 3. Ouvrir une Pull Request via Octokit.
 * 4. Auto-merge si l'auteur a assez de PR mergées (réglage `auto_merge`).
 * 5. En dev, synchroniser le miroir local `content/` après un merge.
 */
import { getCanonicalAnnotations } from '@/lib/content/source'
import { mergeAnnotations } from '@/lib/content/annotations'
import { openContentPr } from '@/lib/github'
import { syncLocalContent } from '@/lib/contentSync'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { recalcReputation } from '@/lib/reputation'
import { config } from '@/lib/config'
import { Octokit } from '@octokit/rest'
import type { Annotation } from '@/lib/types'

interface PrCandidate {
  songId: string
  artistSlug: string
  /** Ids Supabase des annotations à publier (pour le marquage de statut). */
  annotationIds: string[]
  annotations: Annotation[]
  /**
   * Merge immédiat de la PR après ouverture, sans attendre la règle de
   * réputation (`author_min_merged`) — utilisé par l'approbation d'un
   * modérateur. Le vote automatique, lui, garde la règle de réputation.
   */
  forceMerge?: boolean
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

  // Auto-merge : décision modérateur (forceMerge) ou auteur ayant déjà
  // ≥ author_min_merged PR mergées (réputation).
  const autoMerge = settings.auto_merge
  const authorIds = [...new Set(candidate.annotations.map((a) => a.authorId ?? ''))].filter(Boolean)
  let mergedPr = false
  if (config.githubToken) {
    if (candidate.forceMerge) {
      mergedPr = await tryMergePr(number)
    } else if (autoMerge.enabled && authorIds.length === 1) {
      const { count } = await admin
        .from('annotations')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', authorIds[0])
        .eq('status', 'merged')
      if ((count ?? 0) >= autoMerge.author_min_merged) {
        mergedPr = await tryMergePr(number)
      }
    }
  }

  if (mergedPr) {
    // Marquage direct `merged` + réputation (miroir du webhook) : la
    // publication est immédiate même si le webhook GitHub n'est pas joignable.
    await markPrMerged(number)
    return { outcome: 'merged', prNumber: number, prUrl: url }
  }
  return { outcome: 'opened', prNumber: number, prUrl: url }
}

/**
 * Passe en `merged` les annotations et suggestions de lyrics liées à une PR
 * fusionnée, puis recalcule la réputation des auteurs et votants. Utilisé par
 * le webhook GitHub ET après un merge déclenché depuis l'app (forceMerge).
 * Retourne le nombre d'éléments passés à `merged`.
 */
export async function markPrMerged(prNumber: number): Promise<number> {
  const admin = getSupabaseAdmin()
  if (!admin) return 0

  let mergedCount = 0

  // Annotations liées à cette PR (statut `approved`).
  const { data: annotations } = await admin
    .from('annotations')
    .select('id, author_id, status')
    .eq('pr_number', prNumber)
    .in('status', ['approved'])

  if (annotations && annotations.length > 0) {
    await admin
      .from('annotations')
      .update({ status: 'merged' })
      .eq('pr_number', prNumber)
      .in('status', ['approved'])

    // Réputation : auteurs + votants de ces annotations.
    const annotationIds = annotations.map((a) => a.id)
    const { data: votes } = await admin
      .from('votes')
      .select('voter_id')
      .in('annotation_id', annotationIds)

    const affected = new Set<string>()
    for (const ann of annotations) {
      if (ann.author_id) affected.add(ann.author_id)
    }
    for (const vote of votes ?? []) affected.add(vote.voter_id)
    await Promise.all([...affected].map((id) => recalcReputation(id)))
    mergedCount += annotations.length
  }

  // Suggestions de lyrics liées à cette PR → merged.
  const { data: suggestions } = await admin
    .from('lyric_suggestions')
    .select('id')
    .eq('pr_number', prNumber)
    .in('status', ['approved'])
  if (suggestions && suggestions.length > 0) {
    await admin
      .from('lyric_suggestions')
      .update({ status: 'merged' })
      .eq('pr_number', prNumber)
      .in('status', ['approved'])
    mergedCount += suggestions.length
  }

  // Dev : synchronise le miroir local `content/` pour que les lyrics
  // reflètent immédiatement la publication (non bloquant, silencieux en cas
  // d'échec — le merge GitHub reste la source de vérité).
  if (mergedCount > 0) {
    void syncLocalContent()
  }

  return mergedCount
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
