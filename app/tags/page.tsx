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
      <span className="eyebrow">
        <i className="fa-solid fa-tags" aria-hidden="true" /> Explorer
      </span>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">Thématiques</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Les tags des annotations, du plus utilisé au plus rare.
      </p>

      {tags.length === 0 ? (
        <p className="mt-10 text-sm text-ink-faint">
          Aucun tag pour l’instant — dès que la communauté annotera, les thématiques
          apparaîtront ici.
        </p>
      ) : (
        <div className="mt-8 flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="group inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-card px-4 py-2 font-mono text-sm shadow-soft transition-all hover:-translate-y-0.5 hover:border-lamba-red hover:bg-lamba-red hover:text-white hover:shadow-lift"
            >
              <i className="fa-solid fa-hashtag text-xs text-red transition-colors group-hover:text-white" aria-hidden="true" />
              {tag}
              <span className="text-xs text-ink-faint transition-colors group-hover:text-white">
                {count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
