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
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider text-ink-soft">
        <Link href="/tags" className="transition-colors hover:text-red">
          <i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true" />
          Thématiques
        </Link>
      </nav>

      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
        <span className="text-red">#</span>{tag}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        <i className="fa-solid fa-pen-nib mr-1.5" aria-hidden="true" />
        {annotations.length} annotation{annotations.length > 1 ? 's' : ''}
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {annotations.map((ann) => (
          <article
            key={ann.id}
            className="card card-hover p-5"
          >
            <blockquote className="border-l-[3px] border-red pl-3 font-display text-sm italic text-ink-soft">
              {ann.quote}
            </blockquote>
            <p className="mt-2 text-sm leading-relaxed text-ink">{ann.body}</p>
            <div className="mt-3 flex items-center gap-3 font-mono text-xs text-ink-faint">
              <Link href={`/songs/${ann.song_id}`} className="font-semibold text-red hover:underline">
                <i className="fa-solid fa-music mr-1" aria-hidden="true" />
                {ann.song_id}
              </Link>
              <span>@{ann.author}</span>
              <span className="ml-auto">
                <i className="fa-solid fa-arrow-up text-green mr-1" aria-hidden="true" />
                {ann.score} vote{Math.abs(ann.score) > 1 ? 's' : ''}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
