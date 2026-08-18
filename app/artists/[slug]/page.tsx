import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtist, getArtistSongs, listArtistAlbums } from "@/lib/content/source";
import { getArtistImage } from "@/lib/imageUtils";
import CoverImage from "@/components/CoverImage";
import Reveal from "@/components/Reveal";

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: "Artiste introuvable" };
  return { title: artist.name, description: `Titres, lyrics et annotations de ${artist.name} sur Pass'Teny.` };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const [artist, songs] = await Promise.all([getArtist(slug), getArtistSongs(slug)]);

  if (!artist) notFound();

  // Photo de profil si valide, sinon cover de la release la plus récente.
  const artistImage = getArtistImage(artist.coverUrl, songs);

  // ── Le top de l'artiste : classé par annotations (ordre catalogue sinon). ──
  const topSongs = [...songs].sort((a, b) => b.annotationCount - a.annotationCount).slice(0, 5);
  const totalAnnotations = songs.reduce((n, s) => n + s.annotationCount, 0);

  // ── Releases : albums / EP / singles de l'artiste (avec slug + tracklist). ──
  const releases = await listArtistAlbums(slug);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      {/* ── Fil d'ariane ── */}
      <nav className="mb-8 font-mono text-xs uppercase tracking-wider text-ink-soft">
        <Link href="/" className="transition-colors hover:text-red">
          <i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true" />
          Accueil
        </Link>
        <span className="mx-2 text-ink-faint">/</span>
        <span className="text-ink">{artist.name}</span>
      </nav>

      {/* ══ Header artiste premium ══ */}
      <header className="rise mb-14" style={{ animationDelay: "0ms" }}>
        <div className="flex flex-wrap items-center gap-6">
          <CoverImage
            src={artistImage.src}
            alt={`${artist.name} — photo`}
            size="thumb"
            fallback={artistImage.fallback}
            eager
            skipImageKitFallback
            className="h-24 w-24 shrink-0 rounded-full border border-line-strong object-cover shadow-card sm:h-28 sm:w-28"
          />
          <div className="min-w-0 flex-1">
            <span className="eyebrow">
              <i className="fa-solid fa-microphone" aria-hidden="true" /> Artiste
            </span>
            <h1 className="mt-1.5 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {artist.name}
            </h1>

            {/* Stats mono */}
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <dt className="font-mono text-[0.6rem] font-semibold uppercase tracking-[2px] text-ink-faint">
                  Titres
                </dt>
                <dd className="mt-0.5 font-display text-xl font-semibold text-ink">{songs.length}</dd>
              </div>
              <div>
                <dt className="font-mono text-[0.6rem] font-semibold uppercase tracking-[2px] text-ink-faint">
                  Releases
                </dt>
                <dd className="mt-0.5 font-display text-xl font-semibold text-ink">{releases.length}</dd>
              </div>
              <div>
                <dt className="font-mono text-[0.6rem] font-semibold uppercase tracking-[2px] text-ink-faint">
                  Annotations
                </dt>
                <dd className="mt-0.5 font-display text-xl font-semibold text-ink">{totalAnnotations}</dd>
              </div>
            </dl>
          </div>

          {/* CTA écosystème Pass'io */}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
            <a
              href="https://player.passiio.shop"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              <i className="fa-solid fa-play" aria-hidden="true" /> Écouter
            </a>
            <a
              href="https://artist.passiio.shop"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Profil Pass&apos;io
            </a>
          </div>
        </div>
      </header>

      {/* ══ Le top de l'artiste ══ */}
      <Reveal>
        <section className="mb-16">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <span className="eyebrow">
                <i className="fa-solid fa-ranking-star" aria-hidden="true" /> Le chart
              </span>
              <h2 className="section-title mt-1.5">Top titres</h2>
            </div>
            <span className="badge badge-soft-bordeaux mb-1">Top {topSongs.length}</span>
          </div>

          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {topSongs.map((song, i) => (
              <Link
                key={song.slug}
                href={`/songs/${song.slug}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper-alt sm:gap-4 sm:px-5"
              >
                <span className="rank-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <CoverImage
                  src={song.coverUrl}
                  alt=""
                  size="thumb"
                  className="h-12 w-12 shrink-0 rounded-md border border-line-strong object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                    {song.title}
                  </div>
                  <div className="truncate text-sm text-ink-soft">{song.album}</div>
                </div>
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

          {totalAnnotations === 0 && (
            <p className="mt-4 text-center font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint">
              Aucune annotation — ouvrez un titre et soyez la première voix
            </p>
          )}
        </section>
      </Reveal>

      {/* ══ Releases — albums / EP / singles avec tracklists ══ */}
      <Reveal>
        <section id="releases">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <span className="eyebrow">
                <i className="fa-solid fa-compact-disc" aria-hidden="true" /> La discographie
              </span>
              <h2 className="section-title mt-1.5">Releases</h2>
            </div>
            <span className="badge badge-soft-bordeaux mb-1">{releases.length}</span>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            {releases.map((release, r) => (
              <div
                key={release.slug}
                style={{ animationDelay: `${r * 70}ms` }}
                className="card card-hover overflow-hidden"
              >
                {/* En-tête release : cover + type + compteurs → page album */}
                <Link
                  href={`/albums/${release.slug}`}
                  className="group flex items-center gap-4 border-b border-line p-5 transition-colors hover:bg-paper-alt"
                >
                  <CoverImage
                    src={release.coverUrl}
                    alt={`Couverture de « ${release.album} »`}
                    size="card"
                    className="h-20 w-20 shrink-0 rounded-lg border border-line-strong object-cover shadow-soft"
                  />
                  <div className="min-w-0 flex-1">
                    {release.type === "Album" ? (
                      <span className="badge badge-soft-bordeaux">Album</span>
                    ) : release.type === "EP" ? (
                      <span className="badge badge-soft-copper">EP</span>
                    ) : (
                      <span className="badge border border-line-strong bg-card text-ink">Single</span>
                    )}
                    <h3 className="mt-1.5 truncate font-display text-lg font-semibold tracking-tight text-ink transition-colors group-hover:text-red">
                      {release.album}
                    </h3>
                    <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                      {release.trackCount} titre{release.trackCount > 1 ? "s" : ""}
                      {release.annotationCount > 0
                        ? ` · ${release.annotationCount} annotation${release.annotationCount > 1 ? "s" : ""}`
                        : " · à annoter"}
                    </p>
                  </div>
                  <i
                    className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                    aria-hidden="true"
                  />
                </Link>

                  {/* Tracklist */}
                  <div className="divide-y divide-[var(--line)]">
                    {release.tracks.map((song, i) => (
                      <Link
                        key={song.slug}
                        href={`/songs/${song.slug}`}
                        className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-paper-alt"
                      >
                        <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-ink-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink transition-colors group-hover:text-red">
                          {song.title}
                        </span>
                        {song.annotationCount > 0 ? (
                          <span className="shrink-0 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-red">
                            {song.annotationCount} n{song.annotationCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-faint">
                            à annoter
                          </span>
                        )}
                        <i
                          className="fa-solid fa-chevron-right shrink-0 text-[0.6rem] text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                          aria-hidden="true"
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
