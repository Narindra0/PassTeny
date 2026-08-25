import type { Metadata } from "next";
import Link from "next/link";
import { searchAlbums, searchArtists, searchSongs } from "@/lib/search";
import { listSongs } from "@/lib/content/source";
import type { SongSummary } from "@/lib/types";
import { getArtistImage } from "@/lib/imageUtils";
import CoverImage from "@/components/CoverImage";
import SearchInput from "@/components/SearchInput";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  return {
    title: query ? `Recherche « ${query} »` : "Recherche",
    description: "Recherche approfondie dans le catalogue Pass'Teny : titres, albums, artistes et paroles.",
  };
}

const TYPE_BADGE: Record<string, string> = {
  Album: "bg-red/10 text-red",
  EP: "bg-mustard/10 text-mustard-dark",
  Single: "bg-green/10 text-green",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [results, artists, albums, songs] = await Promise.all([
    query.length >= 2 ? searchSongs(query, 50) : Promise.resolve([]),
    query.length >= 2 ? searchArtists(query, 12) : Promise.resolve([]),
    query.length >= 2 ? searchAlbums(query, 12) : Promise.resolve([]),
    listSongs(),
  ]);

  // Enrichit les résultats : cover + nombre d'annotations depuis le catalogue.
  const bySlug = new Map(songs.map((s) => [s.slug, s]));
  const totalMatches = results.length + albums.length + artists.length;

  // Titres groupés par artiste → photo de profil + dernier titre sorti + nb de releases.
  const songsByArtist = new Map<string, SongSummary[]>();
  for (const s of songs) {
    const list = songsByArtist.get(s.artistSlug) ?? [];
    list.push(s);
    songsByArtist.set(s.artistSlug, list);
  }

  function latestSong(artistSlug: string): SongSummary | null {
    const list = songsByArtist.get(artistSlug) ?? [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => {
      const da = new Date(a.releaseDate || 0).getTime() || 0;
      const db = new Date(b.releaseDate || 0).getTime() || 0;
      return db - da;
    })[0] ?? null;
  }

  function releaseCount(artistSlug: string): number {
    return new Set((songsByArtist.get(artistSlug) ?? []).map((s) => s.album).filter(Boolean)).size;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      {/* ── Fil d'ariane ── */}
      <nav className="mb-8 font-mono text-xs uppercase tracking-wider text-ink-soft">
        <Link href="/" className="transition-colors hover:text-red">
          <i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true" />
          Accueil
        </Link>
        <span className="mx-2 text-ink-faint">/</span>
        <span className="text-ink">Recherche</span>
      </nav>

      {/* ══ Header ── */}
      <header className="rise mb-10">
        <span className="eyebrow">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Recherche approfondie
        </span>
        <h1 className="mt-1.5 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          Trouver un titre, un artiste, une parole
        </h1>

        <div className="mt-6 max-w-xl">
          <SearchInput initialQuery={query} />
        </div>
      </header>

      {query.length < 2 ? (
        <div className="card mt-6 px-6 py-14 text-center">
          <i className="fa-solid fa-keyboard text-2xl text-ink-faint" aria-hidden="true" />
          <p className="mt-3 text-sm text-ink-soft">
            Tapez au moins 2 caractères — titre, artiste ou extrait de paroles, sans accents.
          </p>
        </div>
      ) : totalMatches === 0 ? (
        <div className="card mt-6 px-6 py-14 text-center">
          <i className="fa-solid fa-magnifying-glass-minus text-2xl text-ink-faint" aria-hidden="true" />
          <p className="mt-3 text-sm text-ink-soft">Aucun résultat pour « {query} ».</p>
          <p className="mt-1 text-xs text-ink-faint">
            Essayez un extrait plus court, ou le nom d&apos;un artiste du catalogue.
          </p>
        </div>
      ) : (
        <>
          {/* ── Compteur ── */}
          <p className="mb-6 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
            {totalMatches} résultat{totalMatches > 1 ? "s" : ""} pour « {query} »
          </p>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
            {/* ══ Colonne gauche : titres + albums ══ */}
            <div className="min-w-0 space-y-10">
              {/* Titres */}
              {results.length > 0 && (
                <section>
                  <h2 className="mb-4 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    Titres ({results.length})
                  </h2>
                  <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-line bg-card">
                    {results.map((r) => {
                      const extra = bySlug.get(r.slug);
                      return (
                        <li key={r.slug}>
                          <Link
                            href={`/songs/${r.slug}`}
                            className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-paper-alt sm:px-5"
                          >
                            <CoverImage
                              src={extra?.coverUrl}
                              alt={`Cover de ${r.title}`}
                              size="thumb"
                              className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                                {r.title}
                              </span>
                              <span className="block truncate text-sm text-ink-soft">
                                {r.artist}
                                {r.album ? ` · ${r.album}` : ""}
                              </span>
                              {r.snippet && r.snippet.length > 0 && (
                                <span className="mt-1 flex items-start gap-1.5">
                                  <i
                                    className="fa-solid fa-quote-left mt-0.5 shrink-0 text-[0.55rem] text-ink-faint"
                                    aria-hidden="true"
                                  />
                                  <span className="line-clamp-2 font-mono text-[0.7rem] leading-relaxed text-ink-soft">
                                    {r.snippet.map((seg, i) =>
                                      seg.hit ? (
                                        <mark
                                          key={i}
                                          className="rounded-[3px] bg-[var(--hl-strong)] px-0.5 font-semibold text-ink"
                                        >
                                          {seg.text}
                                        </mark>
                                      ) : (
                                        <span key={i}>{seg.text}</span>
                                      )
                                    )}
                                  </span>
                                </span>
                              )}
                            </div>
                            {extra && extra.annotationCount > 0 && (
                              <span className="hidden shrink-0 rounded-full bg-paper-deep px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-soft sm:inline-flex">
                                {extra.annotationCount} annot.
                              </span>
                            )}
                            <i
                              className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* Albums */}
              {albums.length > 0 && (
                <section>
                  <h2 className="mb-4 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    Albums ({albums.length})
                  </h2>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {albums.map((a) => (
                      <li key={a.slug}>
                        <Link
                          href={`/albums/${a.slug}`}
                          className="group flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-3 transition-all hover:border-ink"
                        >
                          <CoverImage
                            src={a.coverUrl}
                            alt={`Cover de ${a.title}`}
                            size="thumb"
                            className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-display text-sm font-semibold text-ink transition-colors group-hover:text-red">
                              {a.title}
                            </span>
                            <span className="block truncate text-xs text-ink-soft">
                              {a.artist} · {a.trackCount} titre{a.trackCount > 1 ? "s" : ""}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.12em] ${TYPE_BADGE[a.type] ?? "bg-paper-deep text-ink-soft"}`}
                          >
                            {a.type}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* ══ Colonne droite : artistes (sticky) ══ */}
            {artists.length > 0 && (
              <aside className="lg:sticky lg:top-24">
                <h2 className="mb-4 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  Artistes ({artists.length})
                </h2>
                <ul className="flex flex-col gap-2">
                  {artists.map((a) => {
                    const songsOf = songsByArtist.get(a.slug) ?? [];
                    const artistImage = getArtistImage(a.coverUrl, songsOf);
                    const latest = latestSong(a.slug);
                    const nbReleases = releaseCount(a.slug);
                    return (
                      <li key={a.slug}>
                        <div className="rounded-xl border border-line bg-card transition-colors hover:border-ink">
                          <Link
                            href={`/artists/${a.slug}`}
                            className="group flex items-center gap-3 px-4 pt-3"
                          >
                            <CoverImage
                              src={artistImage.src}
                              alt={`${a.name} — photo`}
                              size="thumb"
                              fallback={artistImage.fallback}
                              skipImageKitFallback
                              className="h-10 w-10 shrink-0 rounded-full border border-line object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                                {a.name}
                              </span>
                              <span className="block font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                                {a.songCount} titre{a.songCount > 1 ? "s" : ""}
                                {nbReleases > 0 ? ` · ${nbReleases} release${nbReleases > 1 ? "s" : ""}` : ""}
                              </span>
                            </span>
                            <i
                              className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                              aria-hidden="true"
                            />
                          </Link>

                          {latest && (
                            <Link
                              href={`/songs/${latest.slug}`}
                              className="group flex items-center gap-2 px-4 pb-2 pt-2 text-xs text-ink-soft transition-colors hover:text-red"
                            >
                              <i className="fa-solid fa-clock shrink-0 text-[0.55rem] text-ink-faint" aria-hidden="true" />
                              <span className="truncate">
                                Dernier titre : <span className="font-semibold">{latest.title}</span>
                              </span>
                            </Link>
                          )}

                          <Link
                            href={`/artists/${a.slug}#releases`}
                            className="group flex items-center gap-1.5 border-t border-line px-4 py-2 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-ink-faint transition-colors hover:bg-paper-alt hover:text-red"
                          >
                            <i className="fa-solid fa-compact-disc text-[0.6rem]" aria-hidden="true" />
                            Toutes les releases
                            <i className="fa-solid fa-arrow-right ml-auto text-[0.55rem] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
