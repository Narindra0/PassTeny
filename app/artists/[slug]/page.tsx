import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtist, getArtistSongs } from "@/lib/content/source";

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: "Artiste introuvable" };
  return { title: artist.name, description: `Titres et lyrics de ${artist.name} sur Pass'Teny.` };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const [artist, songs] = await Promise.all([getArtist(slug), getArtistSongs(slug)]);

  if (!artist) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="hover:text-amber-600">
          Accueil
        </Link>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{artist.name}</h1>
        <p className="mt-2 text-zinc-500">
          {artist.songCount} titre{artist.songCount > 1 ? "s" : ""} sur Pass{"'"}Teny
        </p>
      </header>

      <div className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {songs.map((song) => (
          <Link
            key={song.slug}
            href={`/songs/${song.slug}`}
            className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium group-hover:text-amber-600 dark:group-hover:text-amber-400">
                {song.title}
              </div>
              <div className="truncate text-sm text-zinc-500">{song.album}</div>
            </div>
            <div className="shrink-0 text-xs text-zinc-400">
              {song.annotationCount > 0
                ? `${song.annotationCount} annotation${song.annotationCount > 1 ? "s" : ""}`
                : "à annoter"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
