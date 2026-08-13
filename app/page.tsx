import Link from "next/link";
import { listArtists, listSongs } from "@/lib/content/source";
import { getArtistImage } from "@/lib/imageUtils";
import CoverImage from "@/components/CoverImage";

export const dynamic = "force-dynamic";

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
  const artistImages = new Map(artists.map((a) => [a.slug, getArtistImage(a.coverUrl, songsByArtist.get(a.slug) ?? [])]));
  const annotatedCount = songs.filter((s) => s.annotationCount > 0).length;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ny hevitry ny <span className="text-amber-500">teny</span>
        </h1>
        <p className="mt-3 max-w-xl leading-relaxed text-zinc-600 dark:text-zinc-400">
          Comprendre chaque parole de la musique malgache : explications,
          proverbes (<em>ohabolana</em>), métaphores et références culturelles,
          annotés par la communauté.
        </p>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">
          {songs.length} titre{songs.length > 1 ? "s" : ""} · {artists.length} artiste
          {artists.length > 1 ? "s" : ""} · {annotatedCount} annoté{annotatedCount > 1 ? "s" : ""}
        </p>

        <form action="/search" className="mt-6 flex max-w-xl gap-2">
          <input
            type="search"
            name="q"
            placeholder="Rechercher un titre, un artiste, une parole…"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 outline-none transition-colors focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Rechercher"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Rechercher
          </button>
        </form>

        <nav className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link href="/glossary" className="font-medium text-amber-600 hover:underline dark:text-amber-400">
            Glossaire des ohabolana
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <Link href="/tags" className="font-medium text-amber-600 hover:underline dark:text-amber-400">
            Thématiques
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <Link href="/search" className="font-medium text-amber-600 hover:underline dark:text-amber-400">
            Recherche
          </Link>
        </nav>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Artistes
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {artists.map((artist) => (
            <Link
              key={artist.slug}
              href={`/artists/${artist.slug}`}
              className="group rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700 dark:hover:bg-zinc-800"
            >
              <CoverImage
                src={artistImages.get(artist.slug)?.src}
                alt=""
                size="thumb"
                fallback={artistImages.get(artist.slug)?.fallback}
                skipImageKitFallback
                eager={artist.slug === artists[0]?.slug}
                className="mb-3 h-14 w-14 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
              />
              <div className="text-base font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400">
                {artist.name}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {artist.songCount} titre{artist.songCount > 1 ? "s" : ""}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Titres
        </h2>
        <div className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {songs.map((song) => (
            <Link
              key={song.slug}
              href={`/songs/${song.slug}`}
              className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <CoverImage
                src={song.coverUrl}
                alt=""
                size="thumb"
                className="h-10 w-10 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  {song.title}
                </div>
                <div className="truncate text-sm text-zinc-500">
                  {song.artist} · {song.album}
                </div>
              </div>
              <div className="shrink-0 text-xs text-zinc-400">
                {song.annotationCount > 0
                  ? `${song.annotationCount} annotation${song.annotationCount > 1 ? "s" : ""}`
                  : "à annoter"}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
