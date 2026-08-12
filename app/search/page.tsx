'use client'

/**
 * Recherche dans l'index des chansons (titre, artiste, paroles).
 */
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Result {
  slug: string
  artistSlug: string
  artist: string
  title: string
  album: string | null
}

function SearchUi() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(initial)
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      const q = query.trim()
      if (q.length < 2) {
        setResults([])
        return
      }
      setSearching(true)
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      if (res.ok) {
        const json = (await res.json()) as { results: Result[] }
        setResults(json.results)
      }
      setSearching(false)
    })()
    return () => controller.abort()
  }, [query])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Recherche</h1>
      <p className="mt-2 text-sm text-zinc-500">Titres, artistes et paroles de la musique malgache.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex. : Metanoïa, Kresnik, « tia anao »…"
          autoFocus
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 outline-none transition-colors focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
          aria-label="Rechercher"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Rechercher
        </button>
      </form>

      <div className="mt-8">
        {query.trim().length >= 2 && searching && <p className="text-sm text-zinc-500">Recherche…</p>}

        {!searching && results.length > 0 && (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {results.map((r) => (
              <Link
                key={r.slug}
                href={`/songs/${r.slug}`}
                className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    {r.title}
                  </div>
                  <div className="truncate text-sm text-zinc-500">
                    {r.artist}
                    {r.album ? ` · ${r.album}` : ''}
                  </div>
                </div>
                <span className="text-zinc-300 group-hover:text-amber-500 dark:text-zinc-600">→</span>
              </Link>
            ))}
          </div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-zinc-500">Aucun résultat pour « {query} ».</p>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-zinc-500">Chargement…</div>}>
      <SearchUi />
    </Suspense>
  )
}
