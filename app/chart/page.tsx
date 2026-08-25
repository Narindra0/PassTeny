import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { listSongs } from '@/lib/content/source'
import {
  countContributors,
  countMergedAnnotations,
  countTotalVotes,
  getSongViews,
  getTopContributors,
  getTopVotedSongs,
  getTotalViews,
  type TopContributor,
} from '@/lib/views'
import { listTopPunchlines } from '@/lib/punchlines'
import CoverImage from '@/components/CoverImage'
import ChartTabs, { ChartSection } from '@/components/ChartTabs'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Le chart',
  description:
    "Les titres les plus vus, les contributeurs les plus actifs, les punchlines les mieux votées et les annotations les plus appréciées du catalogue Pass'Teny.",
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatViews(n: number): string {
  return `${n.toLocaleString('fr-FR')} vue${n > 1 ? 's' : ''}`
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line-strong bg-card px-4 py-3.5">
      <div className="font-grotesk text-2xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </div>
    </div>
  )
}

function Avatar({ username, size = 'h-9 w-9 text-sm' }: { username: string; size?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-red font-grotesk font-bold text-paper ${size}`}
      aria-hidden="true"
    >
      {username.trim().charAt(0).toUpperCase()}
    </span>
  )
}

function PodiumCard({ rank, children, href }: { rank: number; children: ReactNode; href: string }) {
  return (
    <Link href={href} className="rank-card group">
      <div className="rank-num-big px-4 pt-3">{String(rank).padStart(2, '0')}</div>
      {children}
    </Link>
  )
}

function RankRow({ rank, children, href }: { rank: number; children: ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5"
    >
      <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">
        {String(rank).padStart(2, '0')}
      </span>
      {children}
    </Link>
  )
}

function ContributorRow({ contributor, rank }: { contributor: TopContributor; rank: number }) {
  const roleLabel =
    contributor.role === 'moderator'
      ? 'modérateur'
      : contributor.role === 'trusted'
        ? 'de confiance'
        : 'contributeur'
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/contributors/${contributor.username}`}
        className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-paper-alt sm:px-5"
      >
        <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">
          {String(rank).padStart(2, '0')}
        </span>
        <Avatar username={contributor.username} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold text-ink">@{contributor.username}</span>
            {contributor.role !== 'contributor' && (
              <span className="rounded-full border border-mustard bg-mustard/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mustard-dark">
                {roleLabel}
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-faint">
            {contributor.mergedAnnotations} annotation{contributor.mergedAnnotations > 1 ? 's' : ''} publiée
            {contributor.mergedAnnotations > 1 ? 's' : ''}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-grotesk text-base font-bold text-ink">
            {contributor.reputation.toLocaleString('fr-FR')}
          </div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">pts</div>
        </div>
        <i
          className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
          aria-hidden="true"
        />
      </Link>
    </li>
  )
}

function Empty({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <i className={`${icon} text-2xl text-ink-faint`} aria-hidden="true" />
      <p className="mt-4 font-grotesk text-lg font-medium italic tracking-tight text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function ChartPage() {
  const [
    songs,
    views,
    contributors,
    totalViews,
    mergedCount,
    contributorCount,
    totalVotes,
    topVoted,
    punchlines,
  ] = await Promise.all([
    listSongs(),
    getSongViews(),
    getTopContributors(20),
    getTotalViews(),
    countMergedAnnotations(),
    countContributors(),
    countTotalVotes(),
    getTopVotedSongs(10),
    listTopPunchlines(10),
  ])

  // ── Titres les plus vus ──
  const byViews = [...songs].sort((a, b) => {
    const dv = (views.get(b.slug) ?? 0) - (views.get(a.slug) ?? 0)
    if (dv !== 0) return dv
    return b.annotationCount - a.annotationCount
  })
  const viewedPodium = byViews.slice(0, 3)
  const viewedRest = byViews.slice(3, 10)

  // ── Plus annotés ──
  const annotatedTop = [...songs]
    .filter((s) => s.annotationCount > 0)
    .sort((a, b) => b.annotationCount - a.annotationCount)
    .slice(0, 10)
  const annotatedPodium = annotatedTop.slice(0, 3)
  const annotatedRest = annotatedTop.slice(3, 10)

  // ── Top votés (par score d'annotations) ──
  const songById = new Map(songs.map((s) => [s.slug, s]))
  const votedTop = topVoted
    .map((v) => ({ ...v, song: songById.get(v.songId) }))
    .filter((v) => v.song)
  const votedPodium = votedTop.slice(0, 3)
  const votedRest = votedTop.slice(3, 10)

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      {/* ── En-tête ── */}
      <span className="eyebrow">Le chart</span>
      <h1 className="mt-2 font-grotesk text-3xl font-bold uppercase tracking-tight text-ink sm:text-4xl">
        Le top du catalogue
      </h1>
      <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-soft">
        Les titres les plus lus, les annotations les plus votées, les punchlines les plus marquantes
        — classement vivant, mis à jour à chaque visite.
      </p>

      {/* ── Stats globales ── */}
      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <Stat label="titres au catalogue" value={songs.length} />
        <Stat label="vues cumulées" value={totalViews.toLocaleString('fr-FR')} />
        <Stat label="annotations publiées" value={mergedCount} />
        <Stat label="votes émis" value={totalVotes.toLocaleString('fr-FR')} />
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Onglets + classements ── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="mt-14">
        <ChartTabs>
          {/* ── VUES ── */}
          <ChartSection id="views">
            <div className="space-y-10">
              {viewedPodium.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {viewedPodium.map((s, i) => (
                    <PodiumCard key={s.slug} rank={i + 1} href={`/songs/${s.slug}`}>
                      <CoverImage
                        src={s.coverUrl}
                        alt=""
                        size="card"
                        className="relative z-10 mx-auto -mt-4 mb-4 h-[82px] w-[82px] rounded-full border-2 border-card object-cover shadow-[0_0_0_1px_var(--line-strong)]"
                      />
                      <div className="pb-5 text-center">
                        <h3 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">
                          {s.title}
                        </h3>
                        <div className="mt-0.5 text-[12.5px] text-ink-soft">{s.artist}</div>
                        <div className="mt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-red">
                          {formatViews(views.get(s.slug) ?? 0)}
                        </div>
                      </div>
                    </PodiumCard>
                  ))}
                </div>
              )}

              {viewedRest.length > 0 && (
                <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
                  {viewedRest.map((song, i) => (
                    <RankRow key={song.slug} rank={i + 4} href={`/songs/${song.slug}`}>
                      <CoverImage
                        src={song.coverUrl}
                        alt=""
                        size="thumb"
                        className="h-9 w-9 shrink-0 rounded-[3px] border border-line-strong object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                          {song.title}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">
                          {song.artist}{song.album ? ` · ${song.album}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-wider text-red">
                        {formatViews(views.get(song.slug) ?? 0)}
                      </span>
                    </RankRow>
                  ))}
                </div>
              )}

              {byViews.length === 0 && (
                <Empty
                  icon="fa-solid fa-eye-slash"
                  title="Aucune vue pour le moment"
                  description="Les classements apparaîtront dès que les premiers visiteurs exploreront le catalogue."
                />
              )}
            </div>
          </ChartSection>

          {/* ── ANNOTATIONS ── */}
          <ChartSection id="annotations">
            <div className="space-y-10">
              {annotatedPodium.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {annotatedPodium.map((s, i) => (
                    <PodiumCard key={s.slug} rank={i + 1} href={`/songs/${s.slug}`}>
                      <CoverImage
                        src={s.coverUrl}
                        alt=""
                        size="card"
                        className="relative z-10 mx-auto -mt-4 mb-4 h-[82px] w-[82px] rounded-full border-2 border-card object-cover shadow-[0_0_0_1px_var(--line-strong)]"
                      />
                      <div className="pb-5 text-center">
                        <h3 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">
                          {s.title}
                        </h3>
                        <div className="mt-0.5 text-[12.5px] text-ink-soft">{s.artist}</div>
                        <div className="mt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-mustard-dark">
                          {s.annotationCount} note{s.annotationCount > 1 ? 's' : ''}
                        </div>
                      </div>
                    </PodiumCard>
                  ))}
                </div>
              )}

              {annotatedRest.length > 0 && (
                <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
                  {annotatedRest.map((song, i) => (
                    <RankRow key={song.slug} rank={i + 4} href={`/songs/${song.slug}`}>
                      <CoverImage
                        src={song.coverUrl}
                        alt=""
                        size="thumb"
                        className="h-9 w-9 shrink-0 rounded-[3px] border border-line-strong object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                          {song.title}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">
                          {song.artist}{song.album ? ` · ${song.album}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-wider text-mustard-dark">
                        {song.annotationCount} note{song.annotationCount > 1 ? 's' : ''}
                      </span>
                    </RankRow>
                  ))}
                </div>
              )}

              {annotatedTop.length === 0 && (
                <Empty
                  icon="fa-solid fa-pen-nib"
                  title="Aucune annotation publiée"
                  description="Le classement se remplira au fur et à mesure que les annotations sont validées par la communauté."
                />
              )}
            </div>
          </ChartSection>

          {/* ── VOTES ── */}
          <ChartSection id="votes">
            <div className="space-y-10">
              {votedPodium.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {votedPodium.map((v, i) => (
                    <PodiumCard key={v.songId} rank={i + 1} href={`/songs/${v.song!.slug}`}>
                      <CoverImage
                        src={v.song!.coverUrl}
                        alt=""
                        size="card"
                        className="relative z-10 mx-auto -mt-4 mb-4 h-[82px] w-[82px] rounded-full border-2 border-card object-cover shadow-[0_0_0_1px_var(--line-strong)]"
                      />
                      <div className="pb-5 text-center">
                        <h3 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">
                          {v.song!.title}
                        </h3>
                        <div className="mt-0.5 text-[12.5px] text-ink-soft">{v.song!.artist}</div>
                        <div className="mt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-green">
                          <i className="fa-solid fa-arrow-up mr-1 text-[8px]" aria-hidden="true" />
                          {v.totalVotes > 0 ? '+' : ''}{v.totalVotes} votes
                        </div>
                      </div>
                    </PodiumCard>
                  ))}
                </div>
              )}

              {votedRest.length > 0 && (
                <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
                  {votedRest.map((v, i) => (
                    <RankRow key={v.songId} rank={i + 4} href={`/songs/${v.song!.slug}`}>
                      <CoverImage
                        src={v.song!.coverUrl}
                        alt=""
                        size="thumb"
                        className="h-9 w-9 shrink-0 rounded-[3px] border border-line-strong object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                          {v.song!.title}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">
                          {v.song!.artist}{v.song!.album ? ` · ${v.song!.album}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-[10.5px] font-medium uppercase tracking-wider text-green">
                          {v.totalVotes > 0 ? '+' : ''}{v.totalVotes}
                        </span>
                        <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                          {v.annotationCount} note{v.annotationCount > 1 ? 's' : ''}
                        </span>
                      </span>
                    </RankRow>
                  ))}
                </div>
              )}

              {votedTop.length === 0 && (
                <Empty
                  icon="fa-solid fa-arrow-up"
                  title="Aucun vote pour le moment"
                  description="Les votes sur les annotations détermineront les titres les plus appréciés de la communauté."
                />
              )}
            </div>
          </ChartSection>

          {/* ── PUNCHLINES ── */}
          <ChartSection id="punchlines">
            <div className="space-y-10">
              {punchlines.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {punchlines.slice(0, 3).map((p, i) => (
                      <Link
                        key={p.id}
                        href={`/songs/${p.songId}`}
                        className="group card card-hover relative overflow-hidden p-5"
                      >
                        <span className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full bg-red font-grotesk text-xs font-bold text-paper">
                          {i + 1}
                        </span>
                        <span className="absolute top-3 right-3 font-mono text-xs font-bold text-green">
                          {p.score > 0 ? '+' : ''}{p.score}
                        </span>
                        <p className="mt-6 font-display text-base italic leading-relaxed text-ink line-clamp-4">
                          &laquo;&nbsp;{p.quote}&nbsp;&raquo;
                        </p>
                        <div className="mt-4 border-t border-line pt-3">
                          <span className="block truncate text-xs font-bold text-ink-soft transition-colors group-hover:text-red">
                            {p.songTitle}
                          </span>
                          <span className="block truncate text-[11px] text-ink-faint">{p.artistName}</span>
                          <span className="mt-1 block text-[10px] text-ink-faint">par @{p.author}</span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {punchlines.length > 3 && (
                    <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
                      {punchlines.slice(3, 10).map((p, i) => (
                        <Link
                          key={p.id}
                          href={`/songs/${p.songId}`}
                          className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5"
                        >
                          <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">
                            {String(i + 4).padStart(2, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-sm italic text-ink">
                              &laquo;&nbsp;{p.quote}&nbsp;&raquo;
                            </p>
                            <span className="mt-0.5 block text-[11px] text-ink-faint">
                              {p.songTitle} · {p.artistName}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-[10.5px] font-medium text-green">
                            {p.score > 0 ? '+' : ''}{p.score}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Empty
                  icon="fa-solid fa-quote-left"
                  title="Aucune punchline proposée"
                  description="Les meilleures paroles du catalogue seront ici — proposez les vôtres en sélectionnant un passage dans les lyrics."
                />
              )}
            </div>
          </ChartSection>
        </ChartTabs>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Les contributeurs — toujours visible ── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="mt-16">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-red">
              Réputation &amp; contributions
            </span>
            <h2 className="mt-1 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">
              Les voix du catalogue
            </h2>
          </div>
          {contributors.length > 0 && (
            <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
              {contributors.length} contributeur{contributors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {contributors.length > 0 ? (
          <ul className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
            {contributors.map((c, i) => (
              <ContributorRow key={c.id} contributor={c} rank={i + 1} />
            ))}
          </ul>
        ) : (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <span className="lamba-mark" aria-hidden="true" />
            <p className="mt-4 font-grotesk text-xl font-medium italic tracking-tight text-ink">
              Personne n&apos;a encore contribué
            </p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
              Chaque annotation publiée compte des points de réputation. Soyez la première
              voix à éclairer le catalogue.
            </p>
            <Link href="/" className="btn btn-primary btn-sharp mt-5">
              <i className="fa-solid fa-pen-nib" aria-hidden="true" />
              Annoter un titre
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
