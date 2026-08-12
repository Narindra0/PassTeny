import type { Metadata } from 'next'
import Link from 'next/link'
import { listAnnotationsByTag } from '@/lib/tags'

export const dynamic = 'force-dynamic'

interface TagPageProps {
  params: Promise<{ tag: string }>
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params
  return { title: `#${tag}`, description: `Les annotations taguées « ${tag} » sur Pass'Teny.` }
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params
  const annotations = await listAnnotationsByTag(tag)

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/tags" className="hover:text-amber-600">
          Thématiques
        </Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-zinc-800 dark:text-zinc-200">#{tag}</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight">#{tag}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {annotations.length} annotation{annotations.length > 1 ? 's' : ''}
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {annotations.map((ann) => (
          <article
            key={ann.id}
            className="rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700"
          >
            <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic text-zinc-600 dark:text-zinc-400">
              {ann.quote}
            </blockquote>
            <p className="mt-2 text-sm leading-relaxed">{ann.body}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
              <Link href={`/songs/${ann.song_id}`} className="font-medium text-amber-600 hover:underline dark:text-amber-400">
                {ann.song_id}
              </Link>
              <span>@{ann.author}</span>
              <span className="ml-auto">{ann.score} vote{Math.abs(ann.score) > 1 ? 's' : ''}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
