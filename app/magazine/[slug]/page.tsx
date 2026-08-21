import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { listMagazineArticles, type MagazineArticle } from '@/lib/editorial'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = listMagazineArticles().find((a) => a.slug === slug)
  if (!article) return { title: 'Article introuvable' }
  return {
    title: `${article.title} — Magazine Pass'Teny`,
    description: article.excerpt,
  }
}

/** Rendu basique du Markdown en HTML (titres, gras, italique, listes, paragraphes). */
function renderMarkdown(md: string): string {
  return md
    // Titres h2/h3
    .replace(/^## (.+)$/gm, '<h2 class="mt-8 mb-3 font-grotesk text-xl font-bold uppercase tracking-tight text-ink">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="mt-6 mb-2 font-grotesk text-lg font-bold text-ink">$1</h3>')
    // Gras et italique
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-ink-soft">$1</em>')
    // Listes
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm leading-relaxed text-ink-soft list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-sm leading-relaxed text-ink-soft list-decimal">$2</li>')
    // Paragraphes (double saut de ligne)
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<h')) return trimmed
      if (trimmed.startsWith('<li')) return `<ul class="my-3 space-y-1">${trimmed}</ul>`
      return `<p class="text-[0.95rem] leading-relaxed text-ink-soft">${trimmed}</p>`
    })
    .join('\n')
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = listMagazineArticles().find((a) => a.slug === slug)

  if (!article) notFound()

  const CATEGORY_LABEL: Record<MagazineArticle['category'], { label: string; icon: string; color: string }> = {
    portrait: { label: 'Portrait', icon: 'fa-solid fa-microphone', color: 'text-red' },
    analyse: { label: 'Analyse', icon: 'fa-solid fa-magnifying-glass-chart', color: 'text-mustard-dark' },
    communauté: { label: 'Communauté', icon: 'fa-solid fa-users', color: 'text-green' },
    édito: { label: 'Édito', icon: 'fa-solid fa-feather-pointed', color: 'text-red' },
    culture: { label: 'Culture', icon: 'fa-solid fa-landmark', color: 'text-[#6A4C93]' },
  }

  const cat = CATEGORY_LABEL[article.category]

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

          <span className={`inline-flex items-center gap-1.5 rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-paper backdrop-blur-sm`}>
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
              {article.author}
            </span>
            <span className="text-paper/30">·</span>
            <span className="font-mono text-[11px] text-paper/50">{article.date}</span>
            <span className="text-paper/30">·</span>
            <span className="font-mono text-[11px] text-paper/50">{article.readTime}</span>
          </div>

          {article.tags && article.tags.length > 0 && (
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

      {/* ══ Contenu ══ */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* Extrait en gras */}
        <p className="mb-8 border-l-4 border-red pl-5 text-lg font-medium italic leading-relaxed text-ink">
          {article.excerpt}
        </p>

        {/* Corps de l'article */}
        <article
          className="prose-passeny"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
        />

        {/* Footer article */}
        <div className="mt-16 border-t border-line pt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                Écrit par
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink">{article.author}</p>
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
