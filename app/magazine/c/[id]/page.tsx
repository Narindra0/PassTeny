import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getArticle, CATEGORY_LABELS, type CommunityArticle } from '@/lib/articles'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) return { title: 'Article introuvable' }
  return {
    title: `${article.title} — Magazine Pass'Teny`,
    description: article.subtitle || article.content.slice(0, 160),
  }
}

/** Rendu Markdown basique. */
function renderMarkdown(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="mt-8 mb-3 font-grotesk text-xl font-bold uppercase tracking-tight text-ink">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="mt-6 mb-2 font-grotesk text-lg font-bold text-ink">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-ink-soft">$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="my-4 max-w-full rounded-xl border border-line-strong" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-red underline transition-colors hover:text-red-dark">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm leading-relaxed text-ink-soft list-disc">$1</li>')
    .split('\n\n')
    .map((block) => {
      const t = block.trim()
      if (!t) return ''
      if (t.startsWith('<h') || t.startsWith('<img')) return t
      if (t.includes('<li')) return `<ul class="my-3 space-y-1">${t}</ul>`
      return `<p class="text-[0.95rem] leading-relaxed text-ink-soft">${t}</p>`
    })
    .join('\n')
}

export default async function CommunityArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) notFound()

  const cat = CATEGORY_LABELS[article.category]

  return (
    <div className="flex-1">
      {/* ══ Hero ══ */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <nav className="mb-6 font-mono text-[0.65rem] uppercase tracking-wider text-paper/50">
            <Link href="/" className="transition-colors hover:text-white">Accueil</Link>
            <span className="mx-2 text-paper/30">/</span>
            <Link href="/magazine" className="transition-colors hover:text-white">Magazine</Link>
            <span className="mx-2 text-paper/30">/</span>
            <span className="text-paper/70">{article.title}</span>
          </nav>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-paper backdrop-blur-sm">
            <i className={cat.icon} aria-hidden="true" /> {cat.label}
          </span>

          <h1 className="mt-4 font-grotesk text-3xl font-bold leading-tight text-paper sm:text-4xl">
            {article.title}
          </h1>

          {article.subtitle && (
            <p className="mt-2 text-lg text-paper/70">{article.subtitle}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] text-paper/50">
              <i className="fa-solid fa-user mr-1" aria-hidden="true" />
              @{article.authorUsername || 'anonyme'}
            </span>
            <span className="text-paper/30">·</span>
            <span className="font-mono text-[11px] text-paper/50">
              {new Date(article.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {article.readTime && (
              <>
                <span className="text-paper/30">·</span>
                <span className="font-mono text-[11px] text-paper/50">{article.readTime}</span>
              </>
            )}
          </div>

          {article.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-paper/15 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/40">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══ Couverture ══ */}
      {article.coverUrl && (
        <div className="mx-auto max-w-3xl -mt-1 px-4 sm:px-6">
          <img
            src={article.coverUrl}
            alt={article.title}
            className="w-full rounded-2xl border border-line-strong object-cover shadow-lg"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )}

      {/* ══ Contenu ══ */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article
          className="prose-passeny"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
        />

        {/* Footer */}
        <div className="mt-16 border-t border-line pt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                Écrit par
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink">
                @{article.authorUsername || 'anonyme'}
              </p>
            </div>
            <Link
              href="/magazine"
              className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-red hover:text-red"
            >
              <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
              Retour au magazine
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
