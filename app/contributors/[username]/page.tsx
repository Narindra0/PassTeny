import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContributorByUsername } from "@/lib/contributors";
import type { PublishedAnnotation } from "@/lib/contributors";

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

  const { profile, stats, annotations, suggestions } = data;
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

  const statsRow = [
    { label: "réputation", value: profile.reputation.toLocaleString("fr-FR"), suffix: "pts" },
    { label: "annotations publiées", value: stats.merged },
    { label: "votes reçus", value: stats.votesReceived },
    { label: "votes émis", value: stats.votesCast },
    { label: "lyrics publiés", value: stats.lyricSuggestionsMerged },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <Link
        href="/chart"
        className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-ink-faint transition-colors hover:text-red"
      >
        <i className="fa-solid fa-arrow-left text-[10px]" aria-hidden="true" />
        Les voix du catalogue
      </Link>

      {/* ── Carte profil ── */}
      <div className="mt-5 rounded-[6px] border border-line-strong bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <span
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-red font-grotesk text-4xl font-bold text-paper shadow-card"
            aria-hidden="true"
          >
            {profile.username.trim().charAt(0).toUpperCase()}
          </span>
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
              {stats.accountAgeDays > 0 ? ` · ${stats.accountAgeDays} j` : ""}
            </p>
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
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <div className="font-grotesk text-5xl font-bold tracking-tight text-red">
              {profile.reputation.toLocaleString("fr-FR")}
            </div>
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              points de réputation
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-7 grid grid-cols-2 gap-3 border-t border-line pt-6 sm:grid-cols-5">
          {statsRow.map((s) => (
            <div key={s.label}>
              <div className="font-grotesk text-xl font-bold tracking-tight text-ink">
                {s.value}
                {s.suffix && <span className="ml-0.5 text-sm text-ink-faint">{s.suffix}</span>}
              </div>
              <div className="mt-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Annotations publiées ── */}
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-grotesk text-xl font-bold uppercase tracking-tight text-ink">
            Ses annotations publiées
          </h2>
          <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
            {annotations.length}
          </span>
        </div>

        {annotations.length > 0 ? (
          <ul className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
            {annotations.map((ann) => (
              <AnnotationRow key={ann.id} ann={ann} />
            ))}
          </ul>
        ) : (
          <div className="card px-6 py-8 text-center text-sm leading-relaxed text-ink-soft">
            Aucune annotation publiée pour l&apos;instant — le travail de @
            {profile.username} apparaîtra ici après validation.
          </div>
        )}
      </section>

      {/* ── Suggestions de lyrics publiées ── */}
      {suggestions.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-grotesk text-xl font-bold uppercase tracking-tight text-ink">
              Lyrics ajoutés au catalogue
            </h2>
            <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
              {suggestions.length}
            </span>
          </div>
          <ul className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
            {suggestions.map((s) => (
              <li key={s.id} className="border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5">
                <Link href={`/songs/${s.songSlug}`} className="group flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">
                      {s.trackTitle}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">{s.artistName}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                    {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
