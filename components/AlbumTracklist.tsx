import Link from "next/link";
import { listArtistAlbums } from "@/lib/content/source";
import type { Song } from "@/lib/types";
import Reveal from "./Reveal";

/**
 * Tracklist de l'album sous les lyrics : navigation précédent / suivant,
 * titre courant mis en évidence, liens vers l'album et chaque piste.
 */
export default async function AlbumTracklist({ song }: { song: Song }) {
  const albums = await listArtistAlbums(song.artistSlug);
  const album = albums.find((a) => a.album === song.album);
  // Pas de tracklist pertinente pour un single.
  if (!album || album.tracks.length < 2) return null;

  const currentIndex = album.tracks.findIndex((t) => t.slug === song.slug);
  const prev = currentIndex > 0 ? album.tracks[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < album.tracks.length - 1
      ? album.tracks[currentIndex + 1]
      : null;

  return (
    <Reveal>
      <section className="mt-14" aria-label="Tracklist de l'album">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow">
              <i className="fa-solid fa-list-ol" aria-hidden="true" /> La tracklist
            </span>
            <h2 className="section-title mt-1.5">Dans « {album.album} »</h2>
          </div>
          <Link
            href={`/albums/${album.slug}`}
            className="mb-1 shrink-0 font-mono text-[0.68rem] font-semibold uppercase tracking-[1.5px] text-ink-soft underline-offset-4 transition-colors hover:text-red hover:underline"
          >
            Voir l&apos;album <i className="fa-solid fa-arrow-right ml-1" aria-hidden="true" />
          </Link>
        </div>

        {/* Précédent / suivant */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/songs/${prev.slug}`}
              className="card card-hover group flex items-center gap-3 p-4"
            >
              <i
                className="fa-solid fa-arrow-left shrink-0 text-sm text-ink-faint transition-colors group-hover:text-red"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-ink-faint">
                  Titre précédent
                </div>
                <div className="truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                  {prev.title}
                </div>
              </div>
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}

          {next ? (
            <Link
              href={`/songs/${next.slug}`}
              className="card card-hover group flex items-center justify-end gap-3 p-4 text-right"
            >
              <div className="min-w-0">
                <div className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-ink-faint">
                  Titre suivant
                </div>
                <div className="truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                  {next.title}
                </div>
              </div>
              <i
                className="fa-solid fa-arrow-right shrink-0 text-sm text-ink-faint transition-colors group-hover:text-red"
                aria-hidden="true"
              />
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        {/* Tracklist — compacte, sans cover répétée par piste */}
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {album.tracks.map((t, i) => {
            const isCurrent = t.slug === song.slug;
            return (
              <Link
                key={t.slug}
                href={`/songs/${t.slug}`}
                aria-current={isCurrent ? "true" : undefined}
                className={`group flex items-center gap-3 px-4 py-2.5 transition-colors sm:px-5 ${
                  isCurrent ? "bg-hl" : "hover:bg-paper-alt"
                }`}
              >
                <span
                  className={`w-7 shrink-0 text-right font-mono text-sm tabular-nums ${
                    isCurrent ? "font-bold text-mustard-dark" : "text-ink-faint"
                  }`}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                  {t.title}
                </span>
                {isCurrent ? (
                  <span className="badge badge-soft-copper shrink-0">
                    <i className="fa-solid fa-play" aria-hidden="true" /> En lecture
                  </span>
                ) : t.annotationCount > 0 ? (
                  <span className="badge badge-soft-bordeaux shrink-0">
                    <i className="fa-solid fa-pen-nib" aria-hidden="true" />
                    {t.annotationCount}
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
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}
