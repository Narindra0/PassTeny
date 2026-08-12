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
  merged: 'publiée ✓',
  rejected: 'rejetée',
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
      const res = await fetch(`/api/annotations?song_id=${encodeURIComponent(songSlug)}&status=pending`, {
        signal: controller.signal,
      })
      if (res.ok) {
        const json = (await res.json()) as ApiResponse
        setData(json)
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
    <section className="mx-auto w-full max-w-2xl pb-24">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Soumissions de la communauté
      </h2>

      <div className="flex flex-col gap-3">
        {data.annotations.map((ann) => (
          <article
            key={ann.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic text-zinc-600 dark:text-zinc-400">
              {ann.quote}
            </blockquote>
            <p className="mt-2 text-sm leading-relaxed">{ann.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>@{ann.author}</span>
              {ann.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  #{tag}
                </span>
              ))}
              <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 font-medium dark:bg-zinc-800">
                {STATUS_LABEL[ann.status] ?? ann.status}
              </span>
              <span className="font-semibold" title="Score des votes">
                {ann.score} vote{Math.abs(ann.score) > 1 ? 's' : ''}
              </span>
            </div>

            {data.canVote && ann.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={voting === ann.id}
                  onClick={() => vote(ann.id, 1)}
                  className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                >
                  ↑ Exact
                </button>
                <button
                  type="button"
                  disabled={voting === ann.id}
                  onClick={() => vote(ann.id, -1)}
                  className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  ↓ À revoir
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {data.annotations.length > 0 && !data.canVote && (
        <p className="mt-3 text-xs text-zinc-500">
          Les contributeurs de confiance votent pour valider ces soumissions —
          contribuez pour gagner des votes !
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}
