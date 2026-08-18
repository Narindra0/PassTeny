'use client'

/**
 * Soumissions en attente pour un titre + vote (contributeurs de confiance+).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PendingItem {
  id: string
  quote: string
  body: string
  tags: string[]
  status: string
  score: number
  pr_number: number | null
  created_at: string
  author: string
}

interface ApiResponse {
  canVote: boolean
  viewerRole: string | null
  annotations: PendingItem[]
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'en attente de votes',
  approved: 'PR ouverte',
  merged: 'publiée',
  rejected: 'rejetée',
}

const STATUS_ICON: Record<string, string> = {
  pending: 'fa-regular fa-clock',
  approved: 'fa-solid fa-code-branch',
  merged: 'fa-solid fa-circle-check',
  rejected: 'fa-solid fa-circle-xmark',
}

export default function PendingAnnotations({ songSlug, refreshKey }: { songSlug: string; refreshKey: number }) {
  const router = useRouter()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [voting, setVoting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/annotations?song_id=${encodeURIComponent(songSlug)}&status=pending`)
    if (res.ok) {
      const json = (await res.json()) as ApiResponse
      setData(json)
    }
  }, [songSlug])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const res = await fetch(`/api/annotations?song_id=${encodeURIComponent(songSlug)}&status=pending`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const json = (await res.json()) as ApiResponse
          setData(json)
        }
      } catch (e) {
        // Abort propre à la fermeture / au refresh — pas une erreur réelle.
        if ((e as Error).name === 'AbortError') return
        console.error('[pending]', e)
      }
    })()
    return () => controller.abort()
  }, [songSlug, refreshKey])

  async function vote(id: string, value: 1 | -1) {
    setVoting(id)
    setError('')
    const res = await fetch(`/api/annotations/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (res.status === 401) {
      router.push('/auth/signin')
      return
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Erreur lors du vote')
    }
    setVoting(null)
    load()
  }

  if (!data) return null
  if (data.annotations.length === 0) return null

  return (
    <section id="soumissions-communautaires" className="mx-auto w-full max-w-2xl scroll-mt-24 pb-24">
      <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-ink-faint">
        <i className="fa-solid fa-inbox mr-1.5 text-red" aria-hidden="true" />
        Soumissions de la communauté
      </h2>

      <div className="flex flex-col gap-3">
        {data.annotations.map((ann) => (
          <article
            key={ann.id}
            className="card p-4"
          >
            <blockquote className="border-l-2 border-lamba-red pl-3 font-display text-sm italic text-ink-soft">
              {ann.quote}
            </blockquote>
            <p className="mt-2 text-sm leading-relaxed text-ink">{ann.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-ink-faint">
              <span>
                <i className="fa-solid fa-user mr-1" aria-hidden="true" />@{ann.author}
              </span>
              {ann.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-paper-deep px-2 py-0.5 font-bold text-red">
                  <i className="fa-solid fa-hashtag text-[0.6rem]" aria-hidden="true" />{tag}
                </span>
              ))}
              <span className="badge badge-soft-copper ml-auto">
                <i className={STATUS_ICON[ann.status] ?? 'fa-regular fa-clock'} aria-hidden="true" />
                {STATUS_LABEL[ann.status] ?? ann.status}
              </span>
              <span className="font-bold" title="Score des votes">
                <i className="fa-solid fa-arrow-up text-green" aria-hidden="true" />
                {ann.score}
              </span>
            </div>

            {data.canVote && ann.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={voting === ann.id}
                  onClick={() => vote(ann.id, 1)}
                  className="btn btn-sm transition-all hover:-translate-y-0.5 hover:shadow-lift"
                  style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
                >
                  <i className="fa-solid fa-thumbs-up" aria-hidden="true" />
                  Exact
                </button>
                <button
                  type="button"
                  disabled={voting === ann.id}
                  onClick={() => vote(ann.id, -1)}
                  className="btn btn-sm transition-all hover:-translate-y-0.5 hover:bg-ink hover:text-paper hover:shadow-lift"
                >
                  <i className="fa-solid fa-thumbs-down" aria-hidden="true" />
                  À revoir
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {data.annotations.length > 0 && !data.canVote && (
        <p className="mt-3 text-xs text-ink-faint">
          <i className="fa-solid fa-circle-info mr-1.5" aria-hidden="true" />
          Les contributeurs de confiance votent pour valider ces soumissions —
          contribuez pour gagner des votes !
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm font-medium text-red">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  )
}
