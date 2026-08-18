import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { listSongs } from "@/lib/content/source";
import {
  countContributors,
  countMergedAnnotations,
  getSongViews,
  getTopContributors,
  getTotalViews,
  type TopContributor,
} from "@/lib/views";
import CoverImage from "@/components/CoverImage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Le chart",
  description:
    "Les titres les plus vus, les contributeurs les plus actifs et les titres les plus annotés du catalogue Pass'Teny.",
};

/** « 12 vues » / « 1 vue » — mono, cohérent avec la landing. */
function formatViews(n: number): string {
  return `${n.toLocaleString("fr-FR")} vue${n > 1 ? "s" : ""}`;
}

/** Carte de statistique (bandeau du haut). */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[6px] border border-line-strong bg-card px-4 py-3.5">
      <div className="font-grotesk text-2xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}

/** Avatar rond avec l'initiale du pseudo. */
function Avatar({ username, size = "h-9 w-9 text-sm" }: { username: string; size?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-red font-grotesk font-bold text-paper ${size}`}
      aria-hidden="true"
    >
      {username.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Rang d'une liste de contributeurs — ligne cliquable vers le profil public. */
function ContributorRow({ contributor, rank }: { contributor: TopContributor; rank: number }) {
  const roleLabel =
    contributor.role === "moderator"
      ? "modérateur"
      : contributor.role === "trusted"
        ? "de confiance"
        : "contributeur";
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/contributors/${contributor.username}`}
        className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-paper-alt sm:px-5"
      >
      <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">
        {String(rank).padStart(2, "0")}
      </span>
      <Avatar username={contributor.username} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-bold text-ink">@{contributor.username}</span>
          {contributor.role !== "contributor" && (
            <span className="rounded-full border border-mustard bg-mustard/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mustard-dark">
              {roleLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-ink-faint">
          {contributor.mergedAnnotations} annotation
          {contributor.mergedAnnotations > 1 ? "s" : ""} publiée
          {contributor.mergedAnnotations > 1 ? "s" : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-grotesk text-base font-bold text-ink">
          {contributor.reputation.toLocaleString("fr-FR")}
        </div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">pts</div>
      </div>
      <i
        className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
        aria-hidden="true"
      />
      </Link>
    </li>
  );
}

export default async function ChartPage() {
  const [songs, views, contributors, totalViews, mergedCount, contributorCount] = await Promise.all([
    listSongs(),
    getSongViews(),
    getTopContributors(20),
    getTotalViews(),
    countMergedAnnotations(),
    countContributors(),
  ]);

  // ── Titres les plus vus : vues décroissantes, puis notes, puis ordre du
  //    catalogue (tri stable) — déterministe dès le lancement. ──
  const byViews = [...songs].sort((a, b) => {
    const dv = (views.get(b.slug) ?? 0) - (views.get(a.slug) ?? 0);
    if (dv !== 0) return dv;
    return b.annotationCount - a.annotationCount;
  });
  const viewedPodium = byViews.slice(0, 3);
  const viewedRest = byViews.slice(3, 10);

  // ── Plus annotés (canon). ──
  const annotatedTop = [...songs]
    .filter((s) => s.annotationCount > 0)
    .sort((a, b) => b.annotationCount - a.annotationCount)
    .slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      {/* ── En-tête ── */}
      <span className="eyebrow">Le chart</span>
      <h1 className="mt-2 font-grotesk text-3xl font-bold uppercase tracking-tight text-ink sm:text-4xl">
        Le top du catalogue
      </h1>
      <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-soft">
        Les titres les plus lus, les voix qui éclairent le catalogue et les passages
        qui font débat — classement vivant, mis à jour à chaque visite.
      </p>

      {/* ── Stats globales ── */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="titres au catalogue" value={songs.length} />
        <Stat label="vues cumulées" value={totalViews.toLocaleString("fr-FR")} />
        <Stat label="annotations publiées" value={mergedCount} />
        <Stat label="contributeurs" value={contributorCount} />
      </div>

      {/* ── Les titres les plus vus ── */}
      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-red">
              Classement des lectures
            </span>
            <h2 className="mt-1 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">
              Les titres les plus vus
            </h2>
          </div>
          <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
            Top {Math.min(byViews.length, 10)}
          </span>
        </div>

        {/* Podium */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {viewedPodium.map((s, i) => (
            <Link key={s.slug} href={`/songs/${s.slug}`} className="rank-card group">
              <div className="rank-num-big px-4 pt-3">{String(i + 1).padStart(2, "0")}</div>
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
            </Link>
          ))}
        </div>

        {/* Classement 4+ */}
        {viewedRest.length > 0 && (
          <div className="mt-3.5 overflow-hidden rounded-[6px] border border-line-strong bg-card">
            {viewedRest.map((song, i) => (
              <Link
                key={song.slug}
                href={`/songs/${song.slug}`}
                className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5"
              >
                <span className="w-[22px] shrink-0 font-grotesk text-base font-bold text-ink-faint">
                  {String(i + 4).padStart(2, "0")}
                </span>
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
                    {song.artist}
                    {song.album ? ` · ${song.album}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-wider text-red">
                  {formatViews(views.get(song.slug) ?? 0)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {byViews.length === 0 && (
          <div className="card px-6 py-10 text-center text-sm text-ink-soft">
            Aucun titre au catalogue pour le moment.
          </div>
        )}
      </section>

      {/* ── Les contributeurs ── */}
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
              {contributors.length} contributeur{contributors.length > 1 ? "s" : ""}
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

      {/* ── Les plus annotés ── */}
      <section className="mt-16">
        <div className="mb-5">
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-red">
            Le chantier des mots
          </span>
          <h2 className="mt-1 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">
            Les titres les plus annotés
          </h2>
        </div>

        {annotatedTop.length > 0 ? (
          <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
            {annotatedTop.map((song, i) => (
              <Link
                key={song.slug}
                href={`/songs/${song.slug}`}
                className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5"
              >
                <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
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
                    {song.artist}
                    {song.album ? ` · ${song.album}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-wider text-red">
                  {song.annotationCount} note{song.annotationCount > 1 ? "s" : ""}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card px-6 py-8 text-center text-sm leading-relaxed text-ink-soft">
            Aucune annotation publiée pour l&apos;instant — le classement se remplira au
            fil des validations.
          </div>
        )}
      </section>
    </div>
  );
}
