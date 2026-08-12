import type { Metadata } from 'next'
import Link from 'next/link'
import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tags',
  description: "Les thématiques des annotations Pass'Teny : amour, société, spiritualité…",
}

export default async function TagsPage() {
  const tags = await listTags()

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Thématiques</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Les tags des annotations, du plus utilisé au plus rare.
      </p>

      {tags.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          Aucun tag pour l’instant — dès que la communauté annotera, les thématiques
          apparaîtront ici.
        </p>
      ) : (
        <div className="mt-8 flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700 dark:hover:bg-zinc-800"
            >
              #{tag}
              <span className="text-xs text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                {count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
