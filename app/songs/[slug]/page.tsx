import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSong, listArtistAlbums, listArtists } from "@/lib/content/source";
import { config } from "@/lib/config";
import { getSessionUser } from "@/lib/auth";
import { countPendingAnnotations } from "@/lib/moderation";
import CoverImage from "@/components/CoverImage";
import SongContent from "@/components/SongContent";
import ShareCard from "@/components/ShareCard";
import AlbumTracklist from "@/components/AlbumTracklist";

interface SongPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Artistes invités d'un titre : le catalogue ne les porte que dans le titre
 * (« LesGo Interdule (feat. Yuu) », « Breath (Feat. Jey BR, Nanté98 & Spvce Chen) »),
 * `meta.artists` ne contenant que l'artiste principal. On parse le titre et on
 * déduplique l'artiste principal si une collab le liste.
 */
function parseFeats(title: string, metaArtists: string[], mainArtist: string): string[] {
  const fromTitle = title.match(/\(feat\.?\s+([^)]+)\)/i)
  const names = fromTitle
    ? fromTitle[1]!.split(/,|\s*&\s*/).map((s) => s.trim()).filter(Boolean)
    : []
  const fromMeta = metaArtists.length > 1 ? metaArtists.slice(1) : []
  const main = mainArtist.trim().toLowerCase()
  return [...new Set([...names, ...fromMeta])].filter((n) => n.trim().toLowerCase() !== main)
}

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { slug } = await params;
  const song = await getSong(slug);
  if (!song) return { title: "Titre introuvable" };
  const ogUrl = `${config.siteUrl}/api/og?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}${song.coverUrl ? `&cover=${encodeURIComponent(song.coverUrl)}` : ""}`;
  return {
    title: `${song.title} — ${song.artist}`,
    description: `Lyrics et annotations de « ${song.title} » par ${song.artist}. Comprendre chaque parole.`,
    openGraph: {
      title: `${song.title} — ${song.artist}`,
      description: `Lyrics et annotations sur Pass'Teny.`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
  };
}

export default async function SongPage({ params }: SongPageProps) {
  const { slug } = await params;
  const song = await getSong(slug);

  if (!song) notFound();

  // Visiteurs : pas de formulaire d'annotation — visu du passage + connexion.
  const user = await getSessionUser();
  const canAnnotate = Boolean(user);

  // Release d'origine + numéro de piste (héro : « Titre N sur … »).
  const [releases, artists] = await Promise.all([listArtistAlbums(song.artistSlug), listArtists()]);
  const release = releases.find((r) => r.album === song.album);
  const trackIndex = release ? release.tracks.findIndex((t) => t.slug === song.slug) : -1;

  // Invités (feats) + résolution de leur slug d'artiste quand ils ont une page.
  const feats = parseFeats(song.title, song.meta.artists, song.meta.artist);
  const slugByName = new Map(artists.map((a) => [a.name.trim().toLowerCase(), a.slug]));

  // Soumissions en attente de validation (badge du hero → ancre vers la section).
  const pendingCount = await countPendingAnnotations(song.slug);

  return (
    <div className="flex-1">
      {/* ══ Hero — grande cover + titre, façon Genius ══ */}
      <div className="song-hero">
        <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-5 sm:px-6 sm:pb-14">
          {/* Fil d'ariane + partage */}
          <div className="flex items-center justify-between gap-4">
            <nav className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-wider text-paper/50">
              <Link href="/" className="transition-colors hover:text-white">
                Accueil
              </Link>
              <span className="mx-2 text-paper/30">/</span>
              <Link
                href={`/artists/${song.artistSlug}`}
                className="transition-colors hover:text-white"
              >
                {song.artist}
              </Link>
              {release && (
                <>
                  <span className="mx-2 text-paper/30">/</span>
                  <Link
                    href={`/albums/${release.slug}`}
                    className="transition-colors hover:text-white"
                  >
                    {release.album}
                  </Link>
                </>
              )}
            </nav>
            <ShareCard
              variant="on-dark"
              title={song.title}
              artist={song.artist}
              quote={song.lyrics.split("\n")[0] ?? undefined}
              cover={song.coverUrl}
            />
          </div>

          {/* Cover + identité du titre */}
          <div className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-9">
            <CoverImage
              src={song.coverUrl}
              alt={`Couverture de « ${song.title} »`}
              size="detail"
              eager
              className="h-44 w-44 shrink-0 rounded-[4px] border border-paper/25 object-cover shadow-[0_20px_48px_rgba(0,0,0,0.45)] sm:h-60 sm:w-60"
            />

            <div className="min-w-0">
              <h1 className="song-hero-title text-paper">{song.title}</h1>

              <Link
                href={`/artists/${song.artistSlug}`}
                className="mt-2.5 inline-block text-[15px] font-medium text-paper/75 underline decoration-paper/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
              >
                {song.artist}
              </Link>

              {/* Invités */}
              {feats.length > 0 && (
                <p className="mt-1.5 text-[13px] text-paper/60">
                  {feats.length > 1 ? "Invités : " : "Invité : "}
                  {feats.map((f, i) => {
                    const featSlug = slugByName.get(f.trim().toLowerCase())
                    return (
                      <span key={f}>
                        {i > 0 && ", "}
                        {featSlug ? (
                          <Link
                            href={`/artists/${featSlug}`}
                            className="text-paper/85 underline decoration-paper/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white"
                          >
                            {f}
                          </Link>
                        ) : (
                          <span className="text-paper/85">{f}</span>
                        )}
                      </span>
                    )
                  })}
                </p>
              )}

              {/* Release d'origine — cliquable */}
              {release && (
                <p className="mt-1.5 text-[13px] text-paper/60">
                  {release.type === "Single" ? (
                    <>
                      Single ·{" "}
                      <Link
                        href={`/albums/${release.slug}`}
                        className="text-paper/85 underline decoration-paper/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white"
                      >
                        {release.album}
                      </Link>
                    </>
                  ) : (
                    <>
                      Titre {trackIndex >= 0 ? trackIndex + 1 : "—"} sur{" "}
                      <Link
                        href={`/albums/${release.slug}`}
                        className="text-paper/85 underline decoration-paper/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white"
                      >
                        {release.album}
                      </Link>
                    </>
                  )}
                </p>
              )}

              {/* État d'annotation + soumissions en attente + langues */}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11.5px] text-paper/55">
                <span>
                  {song.annotationCount > 0 ? (
                    <>
                      <i className="fa-solid fa-pen-nib mr-1.5 text-red-light" aria-hidden="true" />
                      {song.annotationCount} passage{song.annotationCount > 1 ? "s" : ""} annoté
                      {song.annotationCount > 1 ? "s" : ""}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-pen-nib mr-1.5 text-red-light" aria-hidden="true" />
                      à annoter
                    </>
                  )}
                </span>
                {pendingCount > 0 && (
                  <a
                    href="#soumissions-communautaires"
                    className="rounded-full border border-mustard/60 bg-mustard/10 px-2.5 py-0.5 font-medium text-mustard transition-colors hover:bg-mustard hover:text-ink"
                  >
                    <i className="fa-solid fa-inbox mr-1" aria-hidden="true" />
                    {pendingCount} soumission{pendingCount > 1 ? "s" : ""} en attente
                  </a>
                )}
                {song.meta.language?.map((lang) => (
                  <span
                    key={lang}
                    className="rounded-full border border-paper/25 px-2.5 py-0.5 uppercase tracking-[0.1em]"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Contenu — lyrics annotables + tracklist ══ */}
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <p className="mb-6 border-b border-line pb-4 text-sm text-ink-soft">
          <i className="fa-solid fa-highlighter mr-1.5 text-mustard-dark" aria-hidden="true" />
          Sélectionnez un passage pour l’annoter ou le proposer comme punchline. Cliquez sur un passage surligné pour lire son
          explication.
        </p>

        <div id="paroles" className="scroll-mt-28">
          <SongContent song={song} canAnnotate={canAnnotate} />
        </div>

        {/* Tracklist de l'album — navigation précédent / suivant */}
        <div id="tracklist" className="scroll-mt-28">
          <AlbumTracklist song={song} />
        </div>

        {song.meta.source?.platform === "passio" && (
          <p className="mt-12 border-t-2 border-ink pt-4 font-mono text-[0.65rem] uppercase tracking-wider text-ink-faint">
            <i className="fa-solid fa-circle-info mr-1.5" aria-hidden="true" />
            Paroles issues du catalogue Pass{"'"}io ({song.meta.source.note ?? "album original"}).
          </p>
        )}
      </div>


    </div>
  );
}
