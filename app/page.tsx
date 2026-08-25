import Link from "next/link";
import type { ReactNode } from "react";
import type { Annotation } from "@/lib/types";
import { albumSlug, getSong, listAnnotators, listArtists, listSongs } from "@/lib/content/source";
import { getArtistImage } from "@/lib/imageUtils";
import CoverImage from "@/components/CoverImage";
import SearchTrigger from "@/components/SearchTrigger";
import Reveal from "@/components/Reveal";
import DiscoverRow from "@/components/DiscoverRow";

export const dynamic = "force-dynamic";

/**
 * Graine du mélange « À découvrir » : tirée côté serveur (impure mais hors
 * du corps de composant, donc tolérée par react-hooks/purity) et rejouée à
 * l'identique côté client — hydratation stable.
 */
function pickDiscoverSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

interface HeroLine {
  key: string
  spans: { text: string; ann: Annotation | null }[]
}

/**
 * Les 3 premières lignes non vides des lyrics, découpées par passage annoté
 * (offsets canon) pour le surlignage façon Genius de la carte « Titre du jour ».
 * Fonction pure, exécutée côté serveur — hydratation stable.
 */
function heroLyricLines(lyrics: string, annotations: Annotation[]): HeroLine[] {
  const lines: { key: string; text: string; start: number; end: number }[] = []
  let offset = 0
  for (const raw of lyrics.split('\n')) {
    const text = raw.trim()
    if (text) {
      const start = offset + raw.indexOf(text)
      lines.push({ key: `h-${lines.length}`, text, start, end: start + text.length })
    }
    offset += raw.length + 1
    if (lines.length >= 3) break
  }

  return lines.map((line) => {
    const overlapping = annotations
      .filter((a) => a.end > line.start && a.start < line.end)
      .sort((a, b) => a.start - b.start)
    if (overlapping.length === 0) {
      return { key: line.key, spans: [{ text: line.text, ann: null }] }
    }
    const spans: { text: string; ann: Annotation | null }[] = []
    let cursor = line.start
    for (const ann of overlapping) {
      const s = Math.max(ann.start, line.start)
      const e = Math.min(ann.end, line.end)
      if (s > cursor) spans.push({ text: line.text.slice(cursor - line.start, s - line.start), ann: null })
      if (e > s) spans.push({ text: line.text.slice(s - line.start, e - line.start), ann })
      cursor = Math.max(cursor, e)
    }
    if (cursor < line.end) spans.push({ text: line.text.slice(cursor - line.start), ann: null })
    return { key: line.key, spans }
  })
}

/** Pastille de compteur de section (mono, sur fond latérite dilué). */
function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
      {children}
    </span>
  )
}

export default async function Home() {
  const [artists, songs] = await Promise.all([listArtists(), listSongs()]);

  // Songs groupés par artiste → getArtistImage (photo de profil sinon cover de la
  // release la plus récente), même logique que la page artiste.
  const songsByArtist = new Map<string, typeof songs>();
  for (const song of songs) {
    const list = songsByArtist.get(song.artistSlug) ?? [];
    list.push(song);
    songsByArtist.set(song.artistSlug, list);
  }
  const artistImages = new Map(
    artists.map((a) => [a.slug, getArtistImage(a.coverUrl, songsByArtist.get(a.slug) ?? [])])
  );

  const annotatedCount = songs.filter((s) => s.annotationCount > 0).length;

  // ── Le top : classé par notes (les rangs du hit-parade), l'ordre du
  //    catalogue faisant foi tant que rien n'est annoté (tri stable). ──
  const chart = [...songs].sort((a, b) => b.annotationCount - a.annotationCount);

  // ── Le titre du jour : le premier du top — carte annotée façon Genius. ──
  const heroSong = chart[0] ? await getSong(chart[0].slug) : null;
  const heroNote = heroSong?.annotations[0] ?? null;

  // ── Nouveautés : les albums du catalogue (dernières parutions). ──
  const albums = new Map<
    string,
    { album: string; artist: string; artistSlug: string; coverUrl?: string | null; songCount: number }
  >();
  for (const song of songs) {
    const key = `${song.album}__${song.artistSlug}`;
    const cur =
      albums.get(key) ?? {
        album: song.album,
        artist: song.artist,
        artistSlug: song.artistSlug,
        coverUrl: song.coverUrl,
        songCount: 0,
      };
    cur.songCount++;
    albums.set(key, cur);
  }
  const albumList = [...albums.values()].sort((a, b) => b.songCount - a.songCount);

  // ── Le top : limité à 5 (max 10) — le podium + les 2 suivants. ──
  const top = chart.slice(0, 5);
  const podium = top.slice(0, 3);
  const topRest = top.slice(3);

  // ── Suggestions : hors titre du jour ET hors du top — pas de redondance. ──
  const topSlugs = new Set(top.map((s) => s.slug));
  const discoverSongs = songs
    .filter((s) => s.slug !== heroSong?.slug && !topSlugs.has(s.slug))
    .slice(0, 12);

  const discoverSeed = pickDiscoverSeed();

  // ── Le top communautaire : les annotateurs les plus prolifiques. ──
  const annotators = await listAnnotators(6);

  const progressPct = songs.length ? Math.round((annotatedCount / songs.length) * 100) : 0;

  return (
    <div className="flex-1">
      {/* ══ Hero — l'édition & le titre du jour annoté ══ */}
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6 sm:py-12">
        <section>
          <div className="grid items-start gap-8 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            {/* Colonne éditoriale */}
            <div>
              <span className="eyebrow rise" style={{ animationDelay: "0ms" }}>
                <i className="fa-solid fa-users mr-0.5" aria-hidden="true" />
                Annoté par la communauté malgache
              </span>

              <h1
                className="hero-title rise mt-4 sm:mt-5 text-ink"
                style={{ animationDelay: "70ms" }}
              >
                Ny hevitry ny <em className="serif-accent text-red">teny</em>
              </h1>

              <p
                className="rise mt-4 sm:mt-5 max-w-md text-[0.95rem] sm:text-[1.02rem] leading-relaxed text-ink-soft"
                style={{ animationDelay: "140ms" }}
              >
                Le sens caché de chaque parole malgache —{" "}
                <strong className="font-semibold text-ink">ohabolana</strong>, métaphores,
                références — surligné, expliqué, débattu par ceux qui l&apos;ont vécu.
              </p>

              <div className="rise mt-6 sm:mt-7 flex max-w-md gap-2.5" style={{ animationDelay: "210ms" }}>
                <SearchTrigger
                  label="Rechercher un titre, un artiste, une parole"
                  className="flex flex-1 items-center gap-3 rounded-[3px] border-[1.5px] border-line-strong bg-card px-4 py-3.5 text-left text-sm text-ink-faint transition-colors hover:border-ink"
                >
                  <i className="fa-solid fa-magnifying-glass text-sm" aria-hidden="true" />
                  <span className="truncate">Rechercher un titre, un artiste, une parole…</span>
                </SearchTrigger>
                <SearchTrigger label="Rechercher" className="btn btn-primary btn-sharp hidden shrink-0 sm:inline-flex">
                  <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Rechercher
                </SearchTrigger>
              </div>

              <div className="rise mt-4 sm:mt-5 flex flex-wrap gap-2 sm:gap-2.5" style={{ animationDelay: "280ms" }}>
                <Link
                  href="/glossary"
                  className="rounded-full border-[1.5px] border-line-strong px-4 py-2 text-[0.82rem] font-medium text-ink-soft transition-colors hover:border-red hover:text-red"
                >
                  Glossaire des ohabolana
                </Link>
                <Link
                  href="/tags"
                  className="rounded-full border-[1.5px] border-line-strong px-4 py-2 text-[0.82rem] font-medium text-ink-soft transition-colors hover:border-red hover:text-red"
                >
                  Thématiques
                </Link>
              </div>
            </div>

            {/* Titre du jour — carte annotée façon Genius */}
            {heroSong && (
              <div className="featured rise relative" style={{ animationDelay: "180ms" }}>
                <div className="featured-top">
                  <span className="eyebrow">
                    <i className="fa-solid fa-star" aria-hidden="true" /> Titre du jour
                  </span>
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.13em] text-ink-faint min-[420px]:block">
                    Choisi par la rédaction
                  </span>
                </div>

                <div className="p-5 sm:p-7">
                  <div className="flex items-center gap-3">
                    <CoverImage
                      src={heroSong.coverUrl}
                      alt={`Couverture de « ${heroSong.title} »`}
                      size="card"
                      eager
                      className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-[4px] border border-line-strong object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-grotesk text-lg sm:text-xl font-bold text-ink">
                        {heroSong.title}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-ink-faint">
                        {heroSong.artist} · {heroSong.album}
                      </div>
                    </div>
                  </div>

                  <div className="lyric-block mt-4 sm:mt-5">
                    {heroLyricLines(heroSong.lyrics, heroSong.annotations).map((line) => (
                      <div key={line.key}>
                        {line.spans.map((sp, i) =>
                          sp.ann ? (
                            <span key={i} className="annot" title={sp.ann.body}>
                              {sp.text}
                              {i === 0 && (
                                <span className="annot-badge" aria-hidden="true">
                                  {heroSong.annotationCount}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span key={i}>{sp.text}</span>
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  {heroNote ? (
                    <div className="note-card mt-4 sm:mt-5">
                      <div className="note-label">
                        Note de la communauté · {heroSong.annotationCount} contribution
                        {heroSong.annotationCount > 1 ? "s" : ""}
                      </div>
                      <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-ink-soft">{heroNote.body}</p>
                      <p className="mt-2 font-mono text-[11px] text-ink-faint">
                        @{heroNote.author}
                        {heroNote.tags?.map((t) => ` #${t}`).join("")}
                      </p>
                    </div>
                  ) : (
                    <div className="note-card mt-4 sm:mt-5">
                      <div className="note-label">À annoter</div>
                      <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-ink-soft">
                        Ce titre n&apos;a pas encore d&apos;explication — soyez la première voix.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                    <span className="text-center font-mono text-[11px] sm:text-left sm:text-xs text-ink-faint">
                      {heroSong.annotationCount > 0
                        ? `${heroSong.annotationCount} passage${heroSong.annotationCount > 1 ? "s" : ""} annoté${heroSong.annotationCount > 1 ? "s" : ""} sur ce titre`
                        : "À annoter"}
                    </span>
                    <Link
                      href={`/songs/${heroSong.slug}`}
                      className="btn btn-primary btn-sm btn-sharp relative z-20 w-full justify-center sm:w-auto"
                    >
                      <i className="fa-solid fa-book-open" aria-hidden="true" /> Ouvrir et annoter
                    </Link>
                  </div>
                </div>

                {/* Overlay cliquable — toute la carte ouvre le titre sur mobile */}
                <Link
                  href={`/songs/${heroSong.slug}`}
                  aria-label={`Ouvrir « ${heroSong.title} » de ${heroSong.artist}`}
                  className="absolute inset-0 z-10 transition-colors active:bg-red/5 sm:hidden"
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ══ L'écosystème — bande encre pleine largeur ══ */}
      <section id="eco" className="mt-16 sm:mt-20 scroll-mt-24 bg-ink text-paper">
        <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-6 sm:py-20">
          <div className="max-w-xl">
            <span className="eyebrow">Un seul catalogue, trois usages</span>
            <h2 className="mt-3 font-grotesk text-2xl font-bold uppercase tracking-tight text-paper sm:text-3xl">
              L&apos;écosystème Pass&apos;io
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-paper/65">
              Pass&apos;Teny explique le sens. Pass&apos;io le diffuse. L&apos;espace artiste
              le fait vivre. Trois produits indépendants, tissés autour du même catalogue malgache.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 grid overflow-hidden rounded-md border border-paper/15 bg-paper/15 sm:grid-cols-3">
            {/* gap-px effect via border on inner divs */}
            <div className="border-b border-paper/15 bg-ink p-6 sm:border-b-0 sm:p-7">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper/50">
                01 — écouter
              </p>
              <h3 className="mt-3 font-grotesk text-xl font-bold text-paper">Pass&apos;io</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-paper/60">
                Streaming du catalogue malgache. Le titre s&apos;écoute ici, s&apos;explique
                sur Pass&apos;Teny.
              </p>
              <a
                href="https://player.passiio.shop"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block font-mono text-xs text-red transition-colors hover:text-red-light"
              >
                player.passiio.shop ↗
              </a>
            </div>
            <div className="border-b border-paper/15 bg-red-dark p-6 sm:border-b-0 sm:p-7">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/75">
                02 — comprendre
              </p>
              <h3 className="mt-3 font-grotesk text-xl font-bold text-white">Pass&apos;Teny</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">
                Le sens des paroles, annoté et validé par la communauté, titre par titre.
              </p>
              <span className="mt-4 inline-block font-mono text-xs font-semibold text-white">
                Vous êtes ici
              </span>
            </div>
            <div className="bg-ink p-6 sm:p-7">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper/50">
                03 — publier
              </p>
              <h3 className="mt-3 font-grotesk text-xl font-bold text-paper">Espace artiste</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-paper/60">
                Profil, musique, gestion — l&apos;endroit où un artiste alimente les deux premiers.
              </p>
              <a
                href="https://artist.passiio.shop"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block font-mono text-xs text-red transition-colors hover:text-red-light"
              >
                artist.passiio.shop ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Le catalogue — nouveautés, chart, découverte, chantier, artistes ══ */}
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* ── Nouveautés — les derniers albums ── */}
        {albumList.length > 0 && (
          <Reveal>
            <section className="mt-20">
              <div className="mb-7 flex items-end justify-between">
                <div>
                  <span className="eyebrow">Dernières parutions</span>
                  <h2 className="mt-1.5 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">
                    Nouveautés
                  </h2>
                </div>
                <CountBadge>{albumList.length}</CountBadge>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {albumList.map((al) => (
                  <Link
                    key={`${al.artistSlug}-${al.album}`}
                    href={`/albums/${albumSlug(al.artistSlug, al.album)}`}
                    className="card card-hover group flex items-center gap-3 p-4"
                  >
                    <CoverImage
                      src={al.coverUrl}
                      alt=""
                      size="card"
                      className="h-12 w-12 shrink-0 rounded-[3px] border border-line-strong object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-grotesk text-[15px] font-bold text-ink transition-colors group-hover:text-red">
                        {al.album}
                      </div>
                      <div className="truncate text-[12.5px] text-ink-soft">{al.artist}</div>
                      <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">
                        {al.songCount} TITRE{al.songCount > 1 ? "S" : ""}
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

        {/* ── Le top — podium + classement ── */}
        <Reveal>
          <section id="chart" className="mt-20 scroll-mt-24">
            <div className="mb-7 flex items-end justify-between">
              <div>
                <span className="eyebrow">Le chart</span>
                <h2 className="mt-1.5 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">
                  Le top du catalogue
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <CountBadge>Top {top.length}</CountBadge>
                <Link
                  href="/chart"
                  className="border-b-[1.5px] border-line-strong pb-0.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-red hover:text-red"
                >
                  Tout voir →
                </Link>
              </div>
            </div>

            {/* Podium — gros numéros + vinyle */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {podium.map((s, i) => (
                <Link key={s.slug} href={`/songs/${s.slug}`} className="rank-card group">
                  <div className="rank-num-big px-4 pt-3">{String(i + 1).padStart(2, "0")}</div>
                  <CoverImage
                    src={s.coverUrl}
                    alt=""
                    size="card"
                    className="relative z-10 mx-auto -mt-4 mb-4 h-[82px] w-[82px] rounded-full border-2 border-card object-cover shadow-[0_0_0_1px_var(--line-strong)]"
                  />
                  <div className="pb-5 text-center">
                    <h4 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">
                      {s.title}
                    </h4>
                    <div className="mt-0.5 text-[12.5px] text-ink-soft">{s.artist}</div>
                    <div className="mt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-red">
                      {s.annotationCount > 0
                        ? `${s.annotationCount} note${s.annotationCount > 1 ? "s" : ""}`
                        : "à annoter"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Classement 4+ */}
            {topRest.length > 0 && (
              <div className="mt-3.5 overflow-hidden rounded-[6px] border border-line-strong bg-card">
                {topRest.map((song, i) => (
                  <Link
                    key={song.slug}
                    href={`/songs/${song.slug}`}
                    className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5"
                  >
                    <span className="w-[22px] shrink-0 font-grotesk text-base font-bold text-ink-faint">
                      {String(i + 4).padStart(2, "0")}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong text-[11px] text-ink-soft transition-colors group-hover:border-red group-hover:text-red">
                      <i className="fa-solid fa-play" aria-hidden="true" />
                    </span>
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
                      {song.annotationCount > 0
                        ? `${song.annotationCount} note${song.annotationCount > 1 ? "s" : ""}`
                        : "à annoter"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </Reveal>

        {/* ── À découvrir — suggestions mélangées ── */}
        {discoverSongs.length > 0 && (
          <Reveal>
            <section className="mt-20">
              <div className="mb-6">
                <span className="eyebrow">Suggestions</span>
                <h2 className="mt-1.5 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">
                  À découvrir
                </h2>
              </div>
              <DiscoverRow songs={discoverSongs} seed={discoverSeed} />
            </section>
          </Reveal>
        )}

        {/* ── Le chantier des mots — progression + top annotateurs ── */}
        <Reveal>
          <section className="mt-20">
            <div className="rounded-[6px] border-[1.5px] border-ink bg-card p-5 shadow-card sm:p-7 sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4 sm:gap-5">
                <div className="max-w-md">
                  <h3 className="font-grotesk text-[1.35rem] font-bold uppercase tracking-tight text-ink">
                    Le chantier des mots
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                    Chaque annotation validée rejoint le canon et la réputation de son auteur.
                    Le catalogue s&apos;éclaire parole par parole.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Link href="/add-lyrics" className="btn btn-secondary btn-sm btn-sharp">
                    <i className="fa-solid fa-file-pen" aria-hidden="true" /> Ajouter une parole
                  </Link>
                  {songs[0] && (
                    <Link href={`/songs/${songs[0].slug}`} className="btn btn-primary btn-sm btn-sharp">
                      <i className="fa-solid fa-pen-nib" aria-hidden="true" /> Annoter un titre
                    </Link>
                  )}
                </div>
              </div>

              <div
                className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-red/10"
                role="progressbar"
                aria-valuenow={annotatedCount}
                aria-valuemin={0}
                aria-valuemax={songs.length}
                aria-label="Progression de l'annotation du catalogue"
              >
                <div
                  className="progress-fill h-full rounded-full bg-red"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.03em] text-ink-faint">
                {annotatedCount} / {songs.length} titres annotés — {progressPct}% du catalogue
                éclairé{annotatedCount === 0 ? " — soyez la première voix" : ""}
              </p>
            </div>

            {annotators.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-[6px] border border-line-strong bg-card">
                <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                  <span className="eyebrow">Les voix qui éclairent</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                    Top annotateurs
                  </span>
                </div>
                {annotators.map((a, i) => (
                  <div
                    key={a.author}
                    className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0"
                  >
                    <span className="w-[18px] shrink-0 font-grotesk text-sm font-bold text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">@{a.author}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs font-bold text-red">
                      {a.count} note{a.count > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>

        {/* ── La scène — artistes ── */}
        <Reveal>
          <section id="artistes" className="mt-20 scroll-mt-24">
            <div className="mb-7 flex items-end justify-between">
              <div>
                <span className="eyebrow">La scène</span>
                <h2 className="mt-1.5 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">
                  Artistes
                </h2>
              </div>
              <CountBadge>{artists.length}</CountBadge>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-7">
              {artists.map((artist) => (
                <Link key={artist.slug} href={`/artists/${artist.slug}`} className="group text-center">
                  <div className="mx-auto mb-2.5 w-full max-w-[88px]">
                    <CoverImage
                      src={artistImages.get(artist.slug)?.src}
                      alt=""
                      size="thumb"
                      fallback={artistImages.get(artist.slug)?.fallback}
                      skipImageKitFallback
                      eager={artist.slug === artists[0]?.slug}
                      className="aspect-square w-full rounded-full border border-line-strong object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="truncate text-[13.5px] font-bold text-ink transition-colors group-hover:text-red">
                    {artist.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">
                    {artist.songCount} TITRE{artist.songCount > 1 ? "S" : ""}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
