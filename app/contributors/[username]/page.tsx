import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContributorByUsername } from "@/lib/contributors";
import type { PublishedAnnotation } from "@/lib/contributors";
import ContributorBadges from "@/components/ContributorBadges";
import { computeBadges } from "@/lib/badges";
import ActivityTimeline from "@/components/ActivityTimeline";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

/** Une annotation publiée par le contributeur, avec lien vers le titre. */
function AnnotationRow({ ann }: { ann: PublishedAnnotation }) {
  return (
    <li className="border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
      <blockquote className="border-l-2 border-lamba-red pl-3 font-display text-sm italic leading-relaxed text-ink-soft">
        « {ann.quote} »
      </blockquote>
      <p className="mt-2 text-sm leading-relaxed text-ink">{ann.body}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
        <Link href={`/songs/${ann.songId}`} className="font-semibold text-red transition-colors hover:underline">
          {ann.songTitle}
        </Link>
        {ann.artistName && <span>{ann.artistName}</span>}
        {ann.album && <span>· {ann.album}</span>}
        <span className="ml-auto inline-flex items-center gap-1">
          <i className="fa-solid fa-arrow-up text-green" aria-hidden="true" />
          {ann.score}
        </span>
        <span>{new Date(ann.createdAt).toLocaleDateString("fr-FR")}</span>
      </div>
      {ann.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ann.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-paper-deep px-2 py-0.5 font-mono text-[10px] font-semibold text-red"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export default async function ContributorPage({ params }: PageProps) {
  const { username } = await params;
  const data = await getContributorByUsername(username);
  if (!data) notFound();

  const { profile, stats, annotations, suggestions, activity } = data;
  const joined = new Date(profile.created_at).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
  });
  const roleLabel =
    profile.role === "moderator"
      ? "modérateur"
      : profile.role === "trusted"
        ? "contributeur de confiance"
        : "contributeur";

  const badges = computeBadges({
    merged: stats.merged,
    reputation: profile.reputation,
    votesCast: stats.votesCast,
    lyricSuggestionsMerged: stats.lyricSuggestionsMerged,
    role: profile.role,
  });

  const statsRow = [
    { label: "réputation", value: profile.reputation.toLocaleString("fr-FR"), suffix: "pts", icon: "fa-solid fa-ranking-star" },
    { label: "annotations", value: stats.merged, icon: "fa-solid fa-pen-nib" },
    { label: "votes reçus", value: stats.votesReceived, icon: "fa-solid fa-arrow-up" },
    { label: "votes émis", value: stats.votesCast, icon: "fa-solid fa-check-double" },
    { label: "lyrics publiés", value: stats.lyricSuggestionsMerged, icon: "fa-solid fa-music" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/chart"
        className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint transition-colors hover:text-red"
      >
        <i className="fa-solid fa-arrow-left text-[10px]" aria-hidden="true" />
        Les voix du catalogue
      </Link>

      {/* ══ Carte profil — hero compact ══ */}
      <div className="mt-5 overflow-hidden rounded-xl border border-line-strong bg-card shadow-soft">
        {/* Bandeau coloré en haut */}
        <div className="h-2 bg-gradient-to-r from-red via-mustard to-green" />

        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Avatar + badges */}
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <span
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-red font-grotesk text-4xl font-bold text-paper shadow-card"
                aria-hidden="true"
              >
                {profile.username.trim().charAt(0).toUpperCase()}
              </span>
              {badges.length > 0 && (
                <div className="hidden sm:block">
                  <ContributorBadges badges={badges} />
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-grotesk text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  @{profile.username}
                </h1>
                {profile.role !== "contributor" && (
                  <span className="rounded-full border border-mustard bg-mustard/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mustard-dark">
                    {roleLabel}
                  </span>
                )}
              </div>
              {profile.display_name && (
                <p className="mt-0.5 text-sm text-ink-soft">{profile.display_name}</p>
              )}
              <p className="mt-1 font-mono text-[11px] text-ink-faint">
                Membre depuis {joined}
                {stats.accountAgeDays > 0 ? ` · ${stats.accountAgeDays} jours` : ""}
              </p>

              {/* Liens sociaux */}
              <div className="mt-3 flex flex-wrap gap-3">
                {profile.github_handle && (
                  <a
                    href={`https://github.com/${profile.github_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-red"
                  >
                    <i className="fa-brands fa-github" aria-hidden="true" />
                    GitHub
                  </a>
                )}
                {profile.facebook_url && (
                  <a
                    href={profile.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-red"
                  >
                    <i className="fa-brands fa-facebook" aria-hidden="true" />
                    Facebook
                  </a>
                )}
                {profile.instagram_url && (
                  <a
                    href={profile.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-red"
                  >
                    <i className="fa-brands fa-instagram" aria-hidden="true" />
                    Instagram
                  </a>
                )}
              </div>

              {/* Badges mobile */}
              {badges.length > 0 && (
                <div className="mt-4 sm:hidden">
                  <ContributorBadges badges={badges} />
                </div>
              )}
            </div>

            {/* Réputation — gros chiffre */}
            <div className="shrink-0 text-center sm:text-right">
              <div className="font-grotesk text-5xl font-bold tracking-tight text-red">
                {profile.reputation.toLocaleString("fr-FR")}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                réputation
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-line pt-6 sm:grid-cols-5">
            {statsRow.map((s) => (
              <div key={s.label} className="flex items-start gap-2.5">
                <i className={`mt-0.5 text-xs text-ink-faint ${s.icon}`} aria-hidden="true" />
                <div>
                  <div className="font-grotesk text-lg font-bold tracking-tight text-ink">
                    {s.value}
                    {s.suffix && <span className="ml-0.5 text-xs font-normal text-ink-faint">{s.suffix}</span>}
                  </div>
                  <div className="mt-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Activité récente ══ */}
      {activity.length > 0 && (
        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="font-grotesk text-lg font-bold uppercase tracking-tight text-ink">
              <i className="fa-solid fa-clock-rotate-left mr-2 text-ink-faint" aria-hidden="true" />
              Activité récente
            </h2>
          </div>
          <div className="rounded-xl border border-line-strong bg-card p-5 sm:p-6">
            <ActivityTimeline items={activity} />
          </div>
        </section>
      )}

      {/* ══ Annotations publiées ══ */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-grotesk text-lg font-bold uppercase tracking-tight text-ink">
            <i className="fa-solid fa-pen-nib mr-2 text-red" aria-hidden="true" />
            Annotations publiées
          </h2>
          <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
            {annotations.length}
          </span>
        </div>

        {annotations.length > 0 ? (
          <ul className="overflow-hidden rounded-xl border border-line-strong bg-card">
            {annotations.map((ann) => (
              <AnnotationRow key={ann.id} ann={ann} />
            ))}
          </ul>
        ) : (
          <div className="card px-6 py-8 text-center text-sm leading-relaxed text-ink-soft">
            Aucune annotation publiée pour l&apos;instant — le travail de @{profile.username} apparaîtra ici après validation.
          </div>
        )}
      </section>

      {/* ══ Suggestions de lyrics ══ */}
      {suggestions.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-grotesk text-lg font-bold uppercase tracking-tight text-ink">
              <i className="fa-solid fa-music mr-2 text-mustard-dark" aria-hidden="true" />
              Lyrics proposés
            </h2>
            <div className="flex items-center gap-2">
              {suggestions.filter((s) => s.status === 'merged').length > 0 && (
                <span className="rounded-full bg-green/10 px-2.5 py-1 font-mono text-[11px] font-medium text-green">
                  {suggestions.filter((s) => s.status === 'merged').length} publiés
                </span>
              )}
              {suggestions.filter((s) => s.status === 'pending').length > 0 && (
                <span className="rounded-full bg-mustard/10 px-2.5 py-1 font-mono text-[11px] font-medium text-mustard-dark">
                  {suggestions.filter((s) => s.status === 'pending').length} en attente
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {suggestions.map((s) => {
              const statusColor =
                s.status === 'merged'
                  ? 'bg-green/10 text-green border-green/25'
                  : s.status === 'rejected'
                    ? 'bg-red/10 text-red border-red/25'
                    : 'bg-mustard/10 text-mustard-dark border-mustard/25'
              const statusLabel =
                s.status === 'merged' ? 'Publié' : s.status === 'rejected' ? 'Rejeté' : 'En attente'
              return (
                <Link
                  key={s.id}
                  href={`/songs/${s.songSlug}`}
                  className="card card-hover group overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* Cover */}
                    {s.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.coverUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md border border-line-strong object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-line-strong bg-paper-deep">
                        <i className="fa-solid fa-music text-lg text-ink-faint" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                            {s.trackTitle}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">{s.artistName}</span>
                          {s.albumTitle && (
                            <span className="block truncate text-[11px] text-ink-faint">{s.albumTitle}</span>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      {/* Aperçu des paroles */}
                      {s.lyricsPreview && (
                        <p className="mt-2 border-l-2 border-mustard/30 pl-2 font-display text-[11px] italic leading-relaxed text-ink-faint line-clamp-2">
                          {s.lyricsPreview}
                        </p>
                      )}
                      <span className="mt-1.5 block font-mono text-[10px] text-ink-faint">
                        {new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  );
}
