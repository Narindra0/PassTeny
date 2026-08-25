import type { Metadata } from 'next'
import Link from 'next/link'
import { listMagazineArticles, type MagazineArticle } from '@/lib/editorial'
import { listApprovedArticles, CATEGORY_LABELS, type CommunityArticle, type ArticleCategory } from '@/lib/articles'
import { getSessionUser } from '@/lib/auth'
import CoverImage from '@/components/CoverImage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Magazine',
  description: 'Portraits, analyses de paroles et réflexions sur la scène musicale malgache.',
}

const EDITORIAL_CATEGORIES: MagazineArticle['category'][] = ['édito', 'portrait', 'analyse', 'communauté', 'culture']
const COMMUNITY_CATEGORIES: ArticleCategory[] = ['journal', 'analyse', 'portrait', 'réflexion', 'guide']

const EDITORIAL_CAT_META: Record<string, { label: string; icon: string; color: string }> = {
  portrait: { label: 'Portrait', icon: 'fa-solid fa-microphone', color: 'text-red' },
  analyse: { label: 'Analyse', icon: 'fa-solid fa-magnifying-glass-chart', color: 'text-mustard-dark' },
  communauté: { label: 'Communauté', icon: 'fa-solid fa-users', color: 'text-green' },
  édito: { label: 'Édito', icon: 'fa-solid fa-feather-pointed', color: 'text-red' },
  culture: { label: 'Culture', icon: 'fa-solid fa-landmark', color: 'text-[#6A4C93]' },
}

/** Grande carte éditoriale (premier article). */
function HeroArticle({ article }: { article: MagazineArticle }) {
  const cat = EDITORIAL_CAT_META[article.category]
  return (
    <Link
      href={`/magazine/${article.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-line-strong bg-card transition-all hover:-translate-y-1 hover:shadow-card"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-red">
            <i className={cat.icon} aria-hidden="true" /> {cat.label}
          </span>
          <span className="font-mono text-[10px] text-ink-faint">{article.readTime}</span>
        </div>
        <h2 className="mt-4 font-grotesk text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {article.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{article.excerpt}</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="font-mono text-[10px] text-ink-faint">{article.author}</span>
          <span className="text-ink-faint">·</span>
          <span className="font-mono text-[10px] text-ink-faint">{article.date}</span>
        </div>
      </div>
    </Link>
  )
}

/** Carte éditoriale compacte. */
function EditorialCard({ article }: { article: MagazineArticle }) {
  const cat = EDITORIAL_CAT_META[article.category]
  return (
    <Link
      href={`/magazine/${article.slug}`}
      className="group card card-hover flex items-start gap-4 p-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${cat.color}`}>
            <i className={`${cat.icon} text-[8px]`} aria-hidden="true" /> {cat.label}
          </span>
          <span className="font-mono text-[9px] text-ink-faint">{article.readTime}</span>
        </div>
        <h3 className="mt-1.5 font-grotesk text-sm font-bold text-ink transition-colors group-hover:text-red">
          {article.title}
        </h3>
        {article.subtitle && (
          <p className="mt-0.5 text-[11px] text-ink-faint">{article.subtitle}</p>
        )}
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-soft">
          {article.excerpt}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-[9px] text-ink-faint">{article.author}</span>
          <span className="text-ink-faint">·</span>
          <span className="font-mono text-[9px] text-ink-faint">{article.date}</span>
        </div>
      </div>
      <i
        className="fa-solid fa-chevron-right mt-2 shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
        aria-hidden="true"
      />
    </Link>
  )
}

/** Carte d'article communautaire. */
function CommunityCard({ article }: { article: CommunityArticle }) {
  const cat = CATEGORY_LABELS[article.category]
  return (
    <Link
      href={`/magazine/c/${article.id}`}
      className="group card card-hover flex items-start gap-4 p-4"
    >
      {article.coverUrl && (
        <CoverImage
          src={article.coverUrl}
          alt={article.title}
          size="thumb"
          className="h-16 w-16 shrink-0 rounded-xl border border-line-strong object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${cat.color}`}>
            <i className={`${cat.icon} text-[8px]`} aria-hidden="true" /> {cat.label}
          </span>
          {article.readTime && (
            <span className="font-mono text-[9px] text-ink-faint">{article.readTime}</span>
          )}
        </div>
        <h3 className="mt-1.5 font-grotesk text-sm font-bold text-ink transition-colors group-hover:text-red">
          {article.title}
        </h3>
        {article.subtitle && (
          <p className="mt-0.5 text-[11px] text-ink-faint">{article.subtitle}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-[9px] text-ink-faint">
            @{article.authorUsername || 'anonyme'}
          </span>
          {article.tags.length > 0 && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="font-mono text-[8px] text-ink-faint">
                {article.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
              </span>
            </>
          )}
        </div>
      </div>
      <i
        className="fa-solid fa-chevron-right mt-2 shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
        aria-hidden="true"
      />
    </Link>
  )
}

export default async function MagazinePage() {
  const [editorialArticles, communityArticles, user] = await Promise.all([
    listMagazineArticles(),
    listApprovedArticles(12),
    getSessionUser(),
  ])

  const heroArticle = editorialArticles[0]
  const restEditorial = editorialArticles.slice(1)

  // Grouper les articles éditoriaux par catégorie
  const editorialByCategory = new Map<string, MagazineArticle[]>()
  for (const a of restEditorial) {
    const list = editorialByCategory.get(a.category) ?? []
    list.push(a)
    editorialByCategory.set(a.category, list)
  }

  // Grouper les articles communautaires par catégorie
  const communityByCategory = new Map<ArticleCategory, CommunityArticle[]>()
  for (const a of communityArticles) {
    const list = communityByCategory.get(a.category) ?? []
    list.push(a)
    communityByCategory.set(a.category, list)
  }

  return (
    <div className="flex-1">
      {/* ══ Hero ══ */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-16">
          <span className="eyebrow text-red-light">
            <i className="fa-solid fa-newspaper mr-0.5" aria-hidden="true" /> Éditorial
          </span>
          <h1 className="mt-3 font-grotesk text-3xl font-bold uppercase tracking-tight text-paper sm:text-4xl">
            Le Magazine
          </h1>
          <p className="mt-2 max-w-lg text-sm text-paper/60">
            Portraits d&apos;artistes, analyses de paroles et réflexions sur la scène
            musicale malgache. Contenu écrit par l&apos;équipe et la communauté.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] text-paper/50">
              <i className="fa-solid fa-pen-nib text-[9px] text-red-light" aria-hidden="true" />
              {editorialArticles.length} article{editorialArticles.length > 1 ? 's' : ''} édito{editorialArticles.length > 1 ? 'riaux' : 'rial'}
            </span>
            {communityArticles.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] text-paper/50">
                <i className="fa-solid fa-users text-[9px] text-green" aria-hidden="true" />
                {communityArticles.length} article{communityArticles.length > 1 ? 's' : ''} communautaire{communityArticles.length > 1 ? 's' : ''}
              </span>
            )}
            {user && (
              <Link
                href="/magazine/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-red px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-paper transition-colors hover:bg-red-dark"
              >
                <i className="fa-solid fa-plus text-[9px]" aria-hidden="true" /> Écrire
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ══ Corps ══ */}
      <div className="mx-auto max-w-5xl space-y-16 px-4 py-12 sm:px-6">

        {/* ── Article à la une (éditorial) ── */}
        {heroArticle && (
          <section>
            <HeroArticle article={heroArticle} />
          </section>
        )}

        {/* ── Articles éditoriaux par catégorie ── */}
        {[...editorialByCategory.entries()].map(([category, articles]) => {
          const meta = EDITORIAL_CAT_META[category]
          return (
            <section key={category}>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <span className="eyebrow">
                    <i className={`${meta.icon} mr-0.5`} aria-hidden="true" /> {meta.label}
                  </span>
                  <h2 className="mt-1 font-grotesk text-xl font-bold uppercase tracking-tight text-ink">
                    {category === 'portrait' && 'Artistes du catalogue'}
                    {category === 'analyse' && 'Les paroles décortiquées'}
                    {category === 'communauté' && 'La voix de la communauté'}
                    {category === 'édito' && 'Mot de l\'équipe'}
                    {category === 'culture' && 'Savoir & culture'}
                  </h2>
                </div>
              </div>
              <div className="space-y-3">
                {articles.map((a) => (
                  <EditorialCard key={a.slug} article={a} />
                ))}
              </div>
            </section>
          )
        })}

        {/* ── Séparateur ── */}
        {communityArticles.length > 0 && (
          <div className="border-t border-line pt-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="eyebrow">
                  <i className="fa-solid fa-users mr-0.5" aria-hidden="true" /> Communauté
                </span>
                <h2 className="mt-1 font-grotesk text-xl font-bold uppercase tracking-tight text-ink">
                  Articles de la communauté
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Écrits par les membres de Pass&apos;Teny
                </p>
              </div>
              {user && (
                <Link
                  href="/magazine/new"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 font-mono text-[10px] font-semibold text-ink-soft transition-colors hover:border-red hover:text-red"
                >
                  <i className="fa-solid fa-pen text-[9px]" aria-hidden="true" /> Écrire un article
                </Link>
              )}
            </div>

            {/* Articles communautaires */}
            {[...communityByCategory.entries()].map(([category, articles]) => {
              const catMeta = CATEGORY_LABELS[category]
              return (
                <div key={category} className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 font-grotesk text-sm font-bold text-ink">
                    <i className={`${catMeta.icon} text-xs ${catMeta.color}`} aria-hidden="true" />
                    {catMeta.label}
                    <span className="rounded-full bg-paper-deep px-2 py-0.5 font-mono text-[9px] text-ink-faint">
                      {articles.length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {articles.map((a) => (
                      <CommunityCard key={a.id} article={a} />
                    ))}
                  </div>
                </div>
              )
            })}

            {communityArticles.length === 0 && (
              <div className="card flex flex-col items-center px-6 py-10 text-center">
                <i className="fa-solid fa-pen-fancy text-2xl text-ink-faint" aria-hidden="true" />
                <p className="mt-3 font-grotesk text-lg font-medium italic text-ink">
                  Aucun article communautaire
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Soyez le premier à écrire pour le magazine !
                </p>
                {user && (
                  <Link href="/magazine/new" className="btn btn-primary btn-sm btn-sharp mt-4">
                    <i className="fa-solid fa-pen" aria-hidden="true" /> Écrire un article
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CTA pour écrire ── */}
        {!user && (
          <div className="rounded-2xl border border-line-strong bg-card p-8 text-center">
            <i className="fa-solid fa-pen-fancy text-3xl text-ink-faint" aria-hidden="true" />
            <h2 className="mt-4 font-grotesk text-xl font-bold text-ink">
              Vous avez une voix ?
            </h2>
            <p className="mt-2 max-w-md mx-auto text-sm text-ink-soft">
              Connectez-vous pour écrire des articles, partager vos analyses et contribuer au magazine Pass&apos;Teny.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
