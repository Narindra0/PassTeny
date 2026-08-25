import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlbum, listArtistAlbums } from "@/lib/content/source";
import { config } from "@/lib/config";
import CoverImage from "@/components/CoverImage";
import Reveal from "@/components/Reveal";

interface AlbumPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { slug } = await params;
  const album = await getAlbum(slug);
  if (!album) return { title: "Album introuvable" };
  const ogUrl = `${config.siteUrl}/api/og?title=${encodeURIComponent(album.album)}&artist=${encodeURIComponent(album.artist)}${album.coverUrl ? `&cover=${encodeURIComponent(album.coverUrl)}` : ""}`;
  return {
    title: `${album.album} — ${album.artist}`,
    description: `La tracklist de « ${album.album} » par ${album.artist} sur Pass'Teny.`,
    openGraph: {
      title: `${album.album} — ${album.artist}`,
      description: `Tracklist et annotations de « ${album.album} » sur Pass'Teny.`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
  };
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { slug } = await params;
  const album = await getAlbum(slug);
  if (!album) notFound();

  // Autres releases du même artiste (navigation interne à la discographie).
  const related = (await listArtistAlbums(album.artistSlug)).filter((a) => a.slug !== album.slug);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      {/* ── Fil d'ariane ── */}
      <nav className="mb-8 font-mono text-xs uppercase tracking-wider text-ink-soft">
        <Link href="/" className="transition-colors hover:text-red">
          <i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true" />
          Accueil
        </Link>
        <span className="mx-2 text-ink-faint">/</span>
        <Link href={`/artists/${album.artistSlug}`} className="transition-colors hover:text-red">
          {album.artist}
        </Link>
        <span className="mx-2 text-ink-faint">/</span>
        <span className="text-ink">{album.album}</span>
      </nav>

      {/* ══ Header album ══ */}
      <header className="rise mb-14" style={{ animationDelay: "0ms" }}>
        <div className="flex flex-wrap items-start gap-5 sm:gap-6">
          <CoverImage
            src={album.coverUrl}
            alt={`Couverture de « ${album.album} »`}
            size="detail"
            eager
            className="h-36 w-36 shrink-0 rounded-xl border border-line-strong object-cover shadow-card sm:h-48 sm:w-48"
          />

          <div className="min-w-0 flex-1">
            <span className="eyebrow">
              <i className="fa-solid fa-compact-disc" aria-hidden="true" /> Release ·{" "}
              {album.type === "Album" ? "Album" : album.type === "EP" ? "EP" : "Single"}
            </span>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
              {album.album}
            </h1>
            <Link
              href={`/artists/${album.artistSlug}`}
              className="mt-3 inline-block text-lg text-ink-soft transition-colors hover:text-red"
            >
              <i className="fa-solid fa-microphone mr-2" aria-hidden="true" />
              {album.artist}
            </Link>

            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 sm:gap-x-10">
              <div>
                <dt className="font-mono text-[0.6rem] font-semibold uppercase tracking-[2px] text-ink-faint">
                  Titres
                </dt>
                <dd className="mt-0.5 font-display text-2xl font-semibold text-ink">{album.trackCount}</dd>
              </div>
              <div>
                <dt className="font-mono text-[0.6rem] font-semibold uppercase tracking-[2px] text-ink-faint">
                  Annotations
                </dt>
                <dd className="mt-0.5 font-display text-2xl font-semibold text-ink">
                  {album.annotationCount}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.6rem] font-semibold uppercase tracking-[2px] text-ink-faint">
                  Titres annotés
                </dt>
                <dd className="mt-0.5 font-display text-2xl font-semibold text-ink">
                  {album.tracks.filter((t) => t.annotationCount > 0).length}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
            <a
              href="https://player.passiio.shop"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              <i className="fa-solid fa-play" aria-hidden="true" /> Écouter
            </a>
            {album.tracks[0] && (
              <Link href={`/songs/${album.tracks[0].slug}`} className="btn btn-secondary btn-sm">
                <i className="fa-solid fa-pen-nib" aria-hidden="true" /> Annoter un titre
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ══ Tracklist ══ */}
      <Reveal>
        <section id="tracklist" className="scroll-mt-28">
          <div className="mb-7">
            <span className="eyebrow">
              <i className="fa-solid fa-list-ol" aria-hidden="true" /> La tracklist
            </span>
            <h2 className="section-title mt-1.5">Titres</h2>
          </div>

          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {album.tracks.map((song, i) => (
              <Link
                key={song.slug}
                href={`/songs/${song.slug}`}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-paper-alt sm:px-5"
              >
                <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                  {song.title}
                </span>
                {song.annotationCount > 0 ? (
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-mono text-sm font-bold tabular-nums text-red">
                      {song.annotationCount}
                    </span>
                    <span className="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-ink-faint">
                      note{song.annotationCount > 1 ? "s" : ""}
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                    à annoter
                  </span>
                )}
                <i
                  className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>

          {album.annotationCount === 0 && (
            <p className="mt-4 text-center font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">
              Aucune annotation sur cet album — ouvrez un titre et soyez la première voix
            </p>
          )}
        </section>
      </Reveal>

      {/* ══ Autres releases de l'artiste ══ */}
      {related.length > 0 && (
        <Reveal>
          <section id="discographie" className="mt-16 scroll-mt-28">
            <div className="mb-7">
              <span className="eyebrow">
                <i className="fa-solid fa-compact-disc" aria-hidden="true" /> La discographie
              </span>
              <h2 className="section-title mt-1.5">Autres releases de {album.artist}</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {related.map((rel, i) => (
                <Link
                  key={rel.slug}
                  href={`/albums/${rel.slug}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="card-pop card card-hover group flex items-center gap-4 p-4"
                >
                  <CoverImage
                    src={rel.coverUrl}
                    alt=""
                    size="card"
                    className="h-16 w-16 shrink-0 rounded-lg border border-line-strong object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="badge badge-soft-bordeaux">{rel.type}</span>
                    <div className="mt-1.5 truncate font-display text-[1.02rem] font-semibold text-ink transition-colors group-hover:text-red">
                      {rel.album}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                      {rel.trackCount} titre{rel.trackCount > 1 ? "s" : ""}
                      {rel.annotationCount > 0
                        ? ` · ${rel.annotationCount} note${rel.annotationCount > 1 ? "s" : ""}`
                        : " · à annoter"}
                    </div>
                  </div>
                  <i
                    className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}
