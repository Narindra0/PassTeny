import type { Metadata } from 'next'
import Link from 'next/link'
import { listSongs, listAlbums, listArtists } from '@/lib/content/source'
import { getArtistImage } from '@/lib/imageUtils'
import { listRecentNews, type NewsItem } from '@/lib/editorial'
import CoverImage from '@/components/CoverImage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Découvrir',
  description: "Explorez le catalogue malgache — nouveautés, top annotés, titres par thématique.",
}

/** Ligne horizontale de titres avec scroll. */
function SongRow({ songs }: { songs: { slug: string; title: string; artist: string; coverUrl?: string | null; annotationCount: number }[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {songs.map((s) => (
        <Link
          key={s.slug}
          href={`/songs/${s.slug}`}
          className="group shrink-0 w-[180px] sm:w-[200px]"
        >
          <div className="relative overflow-hidden rounded-xl border border-line-strong bg-card transition-all hover:-translate-y-0.5 hover:shadow-card">
            <CoverImage
              src={s.coverUrl}
              alt={`Couverture de « ${s.title} »`}
              size="card"
              className="aspect-square w-full object-cover"
            />
            {s.annotationCount > 0 && (
              <span className="absolute top-2 right-2 rounded-full bg-red px-2 py-0.5 font-mono text-[9px] font-bold text-white">
                {s.annotationCount} note{s.annotationCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="mt-2 px-0.5">
            <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
              {s.title}
            </span>
            <span className="block truncate text-xs text-ink-faint">{s.artist}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

/** Carte artiste circulaire. */
function ArtistCircle({ slug, name, coverUrl, songCount }: { slug: string; name: string; coverUrl?: string | null; songCount: number }) {
  return (
    <Link href={`/artists/${slug}`} className="group shrink-0 w-[100px] text-center">
      <CoverImage
        src={coverUrl}
        alt={name}
        size="thumb"
        className="mx-auto aspect-square w-full rounded-full border-2 border-line-strong object-cover transition-transform group-hover:scale-105"
      />
      <span className="mt-2 block truncate text-xs font-bold text-ink transition-colors group-hover:text-red">{name}</span>
      <span className="block font-mono text-[9px] text-ink-faint">{songCount} titre{songCount > 1 ? 's' : ''}</span>
    </Link>
  )
}

/** Section avec titre + compteur + lien "Tout voir". */
function Section({ title, icon, count, href, children }: { title: string; icon: string; count?: number; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <span className="eyebrow">
            <i className={icon} aria-hidden="true" /> {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {count !== undefined && (
            <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
              {count}
            </span>
          )}
          {href && (
            <Link
              href={href}
              className="border-b-[1.5px] border-line-strong pb-0.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-red hover:text-red"
            >
              Tout voir →
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

export default async function DiscoverPage() {
  const [songs, albums, artists, news] = await Promise.all([
    listSongs(),
    listAlbums(),
    listArtists(),
    listRecentNews(6),
  ])

  // ── Top annotés ──
  const topAnnotated = [...songs]
    .filter((s) => s.annotationCount > 0)
    .sort((a, b) => b.annotationCount - a.annotationCount)
    .slice(0, 10)

  // ── Derniers albums ──
  const recentAlbums = albums.slice(0, 8)

  // ── Artistes par nombre de titres ──
  const topArtists = [...artists]
    .sort((a, b) => b.songCount - a.songCount)
    .slice(0, 10)

  // ── Sélection aléatoire (hidden gems) ──
  const allSongs = [...songs].sort(() => Math.random() - 0.5)
  const hiddenGems = allSongs
    .filter((s) => s.annotationCount <= 2 && s.annotationCount >= 0)
    .slice(0, 10)

  // ── Les plus grands catalogues ──
  const bigCatalogs = [...artists]
    .sort((a, b) => b.songCount - a.songCount)
    .slice(0, 5)

  // Artist images
  const songsByArtist = new Map<string, typeof songs>()
  for (const song of songs) {
    const list = songsByArtist.get(song.artistSlug) ?? []
    list.push(song)
    songsByArtist.set(song.artistSlug, list)
  }
  const artistImages = new Map(
    artists.map((a) => [a.slug, getArtistImage(a.coverUrl, songsByArtist.get(a.slug) ?? [])])
  )

  return (
    <div className="flex-1">
      {/* ══ Hero ══ */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <span className="eyebrow text-red-light">
            <i className="fa-solid fa-compass mr-0.5" aria-hidden="true" /> Explorer
          </span>
          <h1 className="mt-3 font-grotesk text-3xl font-bold uppercase tracking-tight text-paper sm:text-4xl">
            Découvrir
          </h1>
          <p className="mt-2 max-w-md text-sm text-paper/60">
            Nouveautés, top annotés, titres à découvrir — le catalogue malgache vous attend.
          </p>

          {/* Stats */}
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] text-paper/50">
              <i className="fa-solid fa-music text-[9px] text-red-light" aria-hidden="true" />
              {songs.length} titres
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] text-paper/50">
              <i className="fa-solid fa-compact-disc text-[9px] text-mustard" aria-hidden="true" />
              {albums.length} albums
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] text-paper/50">
              <i className="fa-solid fa-users text-[9px] text-green" aria-hidden="true" />
              {artists.length} artistes
            </span>
          </div>
        </div>
      </section>

      {/* ══ Corps ══ */}
      <div className="mx-auto max-w-5xl space-y-16 px-4 py-12 sm:px-6">

        {/* ── Les plus gros catalogues ── */}
        <Section title="Artistes à suivre" icon="fa-solid fa-star" count={topArtists.length}>
          <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-thin">
            {topArtists.map((a) => (
              <ArtistCircle
                key={a.slug}
                slug={a.slug}
                name={a.name}
                coverUrl={artistImages.get(a.slug)?.src}
                songCount={a.songCount}
              />
            ))}
          </div>
        </Section>

        {/* ── Top annotés ── */}
        {topAnnotated.length > 0 && (
          <Section title="Les plus annotés" icon="fa-solid fa-pen-nib" count={topAnnotated.length} href="/chart">
            <SongRow songs={topAnnotated} />
          </Section>
        )}

        {/* ── Nouveautés ── */}
        {recentAlbums.length > 0 && (
          <Section title="Nouveautés" icon="fa-solid fa-compact-disc" count={recentAlbums.length}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentAlbums.map((al) => (
                <Link
                  key={al.slug}
                  href={`/albums/${al.slug}`}
                  className="group card card-hover overflow-hidden"
                >
                  <CoverImage
                    src={al.coverUrl}
                    alt={`Couverture de « ${al.album} »`}
                    size="card"
                    className="aspect-square w-full object-cover"
                  />
                  <div className="p-3">
                    <span className="badge badge-soft-bordeaux mb-1.5">{al.type}</span>
                    <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                      {al.album}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">{al.artist}</span>
                    <span className="mt-1 block font-mono text-[9px] text-ink-faint">
                      {al.trackCount} titre{al.trackCount > 1 ? 's' : ''} · {al.annotationCount} annotation{al.annotationCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── Actualités récentes ── */}
        {news.length > 0 && (
          <Section title="Actualités" icon="fa-solid fa-newspaper" count={news.length}>
            <div className="space-y-2">
              {news.map((item) => (
                <Link
                  key={item.id}
                  href={item.link ?? '#'}
                  className="group flex items-start gap-3 rounded-xl border border-line-strong bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.type === 'annotation' ? 'bg-red/10 text-red' :
                    item.type === 'contributor' ? 'bg-green/10 text-green' :
                    item.type === 'release' ? 'bg-mustard/10 text-mustard-dark' :
                    'bg-[#6A4C93]/10 text-[#6A4C93]'
                  }`}>
                    <i className={`text-sm ${
                      item.type === 'annotation' ? 'fa-solid fa-pen-nib' :
                      item.type === 'contributor' ? 'fa-solid fa-user-plus' :
                      item.type === 'release' ? 'fa-solid fa-compact-disc' :
                      'fa-solid fa-quote-left'
                    }`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-soft">
                      {item.description}
                    </span>
                    <span className="mt-1 block font-mono text-[9px] text-ink-faint">
                      {item.date}
                    </span>
                  </div>
                  <i
                    className="fa-solid fa-chevron-right mt-1 shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── Liens rapides vers Magazine & Wallpapers ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/magazine"
            className="group card card-hover flex items-center gap-3 p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red/10 text-red">
              <i className="fa-solid fa-newspaper text-sm" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block font-grotesk text-sm font-bold text-ink transition-colors group-hover:text-red">
                Magazine
              </span>
              <span className="block text-[11px] text-ink-faint">
                Portraits, analyses, communauté
              </span>
            </div>
            <i className="fa-solid fa-chevron-right ml-auto shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red" aria-hidden="true" />
          </Link>
          <Link
            href="/wallpapers"
            className="group card card-hover flex items-center gap-3 p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mustard/10 text-mustard-dark">
              <i className="fa-solid fa-image text-sm" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block font-grotesk text-sm font-bold text-ink transition-colors group-hover:text-red">
                Wallpapers
              </span>
              <span className="block text-[11px] text-ink-faint">
                Fonds d&apos;écran du catalogue
              </span>
            </div>
            <i className="fa-solid fa-chevron-right ml-auto shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red" aria-hidden="true" />
          </Link>
        </div>

        {/* ── Hidden gems — titres peu connus à découvrir ── */}
        {hiddenGems.length > 0 && (
          <Section title="Titres à découvrir" icon="fa-solid fa-gem" count={hiddenGems.length}>
            <SongRow songs={hiddenGems} />
          </Section>
        )}

        {/* ── Par artiste — les plus grands catalogues ── */}
        <Section title="Explorer par artiste" icon="fa-solid fa-microphone">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bigCatalogs.map((a) => (
              <Link
                key={a.slug}
                href={`/artists/${a.slug}`}
                className="group card card-hover flex items-center gap-4 p-4"
              >
                <CoverImage
                  src={artistImages.get(a.slug)?.src}
                  alt=""
                  size="thumb"
                  fallback={artistImages.get(a.slug)?.fallback}
                  className="h-14 w-14 shrink-0 rounded-full border border-line-strong object-cover"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                    {a.name}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {a.songCount} titre{a.songCount > 1 ? 's' : ''} dans le catalogue
                  </span>
                </div>
                <i className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </Section>

        {/* ── Tout le catalogue ── */}
        <Section title="Tout le catalogue" icon="fa-solid fa-list" count={songs.length} href="/chart">
          <div className="rounded-xl border border-line-strong bg-card p-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {songs.slice(0, 20).map((s) => (
                <Link
                  key={s.slug}
                  href={`/songs/${s.slug}`}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-paper-alt"
                >
                  <CoverImage
                    src={s.coverUrl}
                    alt=""
                    size="thumb"
                    className="h-9 w-9 shrink-0 rounded-md border border-line-strong object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink transition-colors group-hover:text-red">
                      {s.title}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">{s.artist}</span>
                  </div>
                  {s.annotationCount > 0 && (
                    <span className="shrink-0 font-mono text-[9px] font-bold text-red">
                      {s.annotationCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            {songs.length > 20 && (
              <Link
                href="/chart"
                className="mt-3 block text-center text-xs font-medium text-red hover:underline"
              >
                Voir les {songs.length} titres →
              </Link>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}
