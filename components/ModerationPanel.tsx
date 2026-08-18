'use client'

/**
 * Panneau de modération : soumissions d'annotations + suggestions de lyrics.
 * L'approbation d'une annotation ouvre la PR sur le repo content et la
 * fusionne immédiatement (auto-merge) — la soumission passe à `merged`.
 */
import { useState } from 'react'

interface Suggestion {
  id: string
  author: string
  artist_name: string
  track_title: string
  album_title: string | null
  lyrics_format: 'lrc' | 'txt'
  status: string
  pr_number: number | null
  created_at: string
}

interface AnnotationRow {
  id: string
  song_id: string
  song_title: string
  artist_name: string
  album: string | null
  quote: string
  body: string
  tags: string[]
  status: string
  score: number
  pr_number: number | null
  created_at: string
  author: string
}

interface ModerationPanelProps {
  annotations: AnnotationRow[]
  suggestions: Suggestion[]
  repoPath: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'border-mustard bg-mustard/10 text-mustard-dark' },
  approved: { label: 'PR ouverte', className: 'border-red bg-red/10 text-red' },
  merged: { label: 'Publié', className: 'border-green bg-green/10 text-green' },
  rejected: { label: 'Refusé', className: 'border-line-strong bg-paper-deep text-ink-faint' },
}

function statusPriority(s: { status: string }): number {
  if (s.status === 'pending') return 0
  if (s.status === 'approved') return 1
  if (s.status === 'rejected') return 2
  return 3
}

function prUrl(repoPath: string, prNumber: number): string {
  return `https://github.com/${repoPath}/pull/${prNumber}`
}

export default function ModerationPanel({ annotations, suggestions, repoPath }: ModerationPanelProps) {
  const [annRows, setAnnRows] = useState<AnnotationRow[]>(annotations)
  const [rows, setRows] = useState<Suggestion[]>(suggestions)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [lastPr, setLastPr] = useState<{ url: string; number: number; merged: boolean } | null>(null)

  const sortedAnn = [...annRows].sort((a, b) => statusPriority(a) - statusPriority(b))
  const sorted = [...rows].sort((a, b) => statusPriority(a) - statusPriority(b))
  const pendingAnnCount = annRows.filter((a) => a.status === 'pending').length
  const pendingSuggCount = rows.filter((s) => s.status === 'pending').length
  const empty = sortedAnn.length === 0 && sorted.length === 0

  async function actSuggestion(s: Suggestion, action: 'approve' | 'reject') {
    setBusyId(s.id)
    setError('')
    setLastPr(null)
    try {
      const res = await fetch(`/api/moderation/suggestions/${s.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Action impossible')
        return
      }
      setRows((r) =>
        r.map((row) =>
          row.id === s.id
            ? { ...row, status: action === 'approve' ? 'approved' : 'rejected', pr_number: data.prNumber ?? row.pr_number }
            : row,
        ),
      )
      if (action === 'approve' && data.prUrl) setLastPr({ url: data.prUrl, number: data.prNumber, merged: false })
    } catch {
      setError('Erreur réseau — réessayez.')
    } finally {
      setBusyId(null)
    }
  }

  async function actAnnotation(a: AnnotationRow, action: 'approve' | 'reject') {
    setBusyId(a.id)
    setError('')
    setLastPr(null)
    try {
      const res = await fetch(`/api/moderation/annotations/${a.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Action impossible')
        return
      }
      setAnnRows((r) =>
        r.map((row) =>
          row.id === a.id
            ? {
                ...row,
                status: action === 'approve' ? (data.merged ? 'merged' : 'approved') : 'rejected',
                pr_number: data.prNumber ?? row.pr_number,
              }
            : row,
        ),
      )
      if (action === 'approve' && data.prUrl) {
        setLastPr({ url: data.prUrl, number: data.prNumber, merged: data.merged === true })
      }
    } catch {
      setError('Erreur réseau — réessayez.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <span className="sticker red">
        <i className="fa-solid fa-gavel mr-1.5" aria-hidden="true" />
        Modération
      </span>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        File de modération
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
        Approuver une annotation publie immédiatement : la pull request est ouverte puis fusionnée
        sur le repo content, sans attente de merge manuel.
      </p>

      {lastPr && (
        <div className="mt-6 rounded-xl border-2 border-green bg-green/10 p-4 text-sm text-ink">
          <p className="font-semibold">
            <i className="fa-solid fa-circle-check mr-2 text-green" aria-hidden="true" />
            {lastPr.merged
              ? 'Annotation approuvée et publiée — la PR a été fusionnée, elle paraît dans les lyrics.'
              : 'Soumission approuvée et publiée.'}
          </p>
          <a
            href={lastPr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 font-medium text-red hover:underline"
          >
            <i className="fa-brands fa-github" aria-hidden="true" />
            {lastPr.merged ? `Voir la PR #${lastPr.number} fusionnée` : 'Voir le commit'}
          </a>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />
          {error}
        </p>
      )}

      {empty ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-10 text-center">
          <span className="lamba-mark" aria-hidden="true" />
          <p className="mt-4 font-display text-xl font-medium italic tracking-tight text-ink">
            Rien à modérer
          </p>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
            Les nouvelles soumissions d&apos;annotations et propositions de lyrics apparaîtront ici.
          </p>
        </div>
      ) : (
        <>
          {/* ══ Annotations ══ */}
          {sortedAnn.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
                  Annotations à modérer
                </h2>
                <span className="rounded-full bg-mustard/10 px-2.5 py-1 font-mono text-[11px] font-medium text-mustard-dark">
                  {pendingAnnCount} en attente
                </span>
              </div>
              <ul className="card divide-y divide-[var(--line)] overflow-hidden">
                {sortedAnn.map((a) => {
                  const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.pending!
                  return (
                    <li key={a.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <blockquote className="border-l-2 border-lamba-red pl-3 font-display text-sm italic leading-relaxed text-ink-soft">
                            « {a.quote} »
                          </blockquote>
                          <p className="mt-2 text-sm leading-relaxed text-ink">{a.body}</p>
                          <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                            {a.song_title}
                            {a.artist_name ? ` · ${a.artist_name}` : ''}
                            {a.album ? ` · ${a.album}` : ''} · @{a.author} ·{' '}
                            {new Date(a.created_at).toLocaleDateString('fr-FR')}
                          </p>
                          {a.tags.length > 0 && (
                            <p className="mt-1.5 flex flex-wrap gap-1.5">
                              {a.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-paper-deep px-2 py-0.5 font-mono text-[0.58rem] font-semibold text-red"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.15em] text-ink-faint">
                          <i className="fa-solid fa-arrow-up mr-1 text-green" aria-hidden="true" />
                          {a.score}
                        </span>
                        {a.pr_number ? (
                          <a
                            href={prUrl(repoPath, a.pr_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-ink-soft transition-colors hover:text-red"
                          >
                            <i className="fa-brands fa-github" aria-hidden="true" />
                            PR #{a.pr_number}
                          </a>
                        ) : a.status === 'pending' ? (
                          <span className="font-mono text-[0.62rem] uppercase tracking-[0.15em] text-ink-faint">
                            Pas encore de PR
                          </span>
                        ) : null}

                        {a.status === 'pending' && (
                          <div className="ml-auto flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => actAnnotation(a, 'approve')}
                              className="btn btn-primary btn-sm"
                            >
                              {busyId === a.id ? (
                                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                              ) : (
                                <i className="fa-solid fa-check" aria-hidden="true" />
                              )}
                              Approuver
                            </button>
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => actAnnotation(a, 'reject')}
                              className="btn btn-secondary btn-sm"
                            >
                              <i className="fa-solid fa-xmark" aria-hidden="true" />
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* ══ Suggestions de lyrics ══ */}
          {sorted.length > 0 && (
            <section className="mt-12">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
                  Suggestions de lyrics
                </h2>
                <span className="rounded-full bg-mustard/10 px-2.5 py-1 font-mono text-[11px] font-medium text-mustard-dark">
                  {pendingSuggCount} en attente
                </span>
              </div>
              <ul className="card divide-y divide-[var(--line)] overflow-hidden">
                {sorted.map((s) => {
                  const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.pending!
                  return (
                    <li key={s.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-base font-semibold text-ink">
                            {s.track_title}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-ink-soft">
                            {s.artist_name}
                            {s.album_title ? ` · ${s.album_title}` : ''}
                          </p>
                          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                            @{s.author} · {s.lyrics_format.toUpperCase()} ·{' '}
                            {new Date(s.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {s.pr_number ? (
                          <a
                            href={prUrl(repoPath, s.pr_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-ink-soft transition-colors hover:text-red"
                          >
                            <i className="fa-brands fa-github" aria-hidden="true" />
                            PR #{s.pr_number}
                          </a>
                        ) : (
                          <span className="font-mono text-[0.62rem] uppercase tracking-[0.15em] text-ink-faint">
                            Pas encore de PR
                          </span>
                        )}

                        {s.status === 'pending' && (
                          <div className="ml-auto flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => actSuggestion(s, 'approve')}
                              className="btn btn-primary btn-sm"
                            >
                              {busyId === s.id ? (
                                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                              ) : (
                                <i className="fa-solid fa-check" aria-hidden="true" />
                              )}
                              Approuver
                            </button>
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => actSuggestion(s, 'reject')}
                              className="btn btn-secondary btn-sm"
                            >
                              <i className="fa-solid fa-xmark" aria-hidden="true" />
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
