import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSong } from "@/lib/content/source";
import LyricsView from "@/components/LyricsView";

interface SongPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { slug } = await params;
  const song = await getSong(slug);
  if (!song) return { title: "Titre introuvable" };
  return {
    title: `${song.title} — ${song.artist}`,
    description: `Lyrics et annotations de « ${song.title} » par ${song.artist}. Comprendre chaque parole.`,
    openGraph: {
      title: `${song.title} — ${song.artist}`,
      description: `Lyrics et annotations sur Pass'Teny.`,
      images: song.coverUrl ? [{ url: song.coverUrl }] : undefined,
    },
  };
}

export default async function SongPage({ params }: SongPageProps) {
  const { slug } = await params;
  const song = await getSong(slug);

  if (!song) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="hover:text-amber-600">
          Accueil
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/artists/${song.artistSlug}`} className="hover:text-amber-600">
          {song.artist}
        </Link>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{song.title}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {song.artist} · {song.album}
        </p>
        {song.meta.releaseDate && (
          <p className="mt-1 text-sm text-zinc-500">{song.meta.releaseDate}</p>
        )}
        {song.meta.language && song.meta.language.length > 0 && (
          <div className="mt-3 flex gap-2">
            {song.meta.language.map((lang) => (
              <span
                key={lang}
                className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700"
              >
                {lang}
              </span>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm text-zinc-500">
          Cliquez sur un passage surligné pour lire son explication.
        </p>
      </header>

      <LyricsView lyrics={song.lyrics} annotations={song.annotations} />

      {song.meta.source?.platform === "passio" && (
        <p className="mt-12 border-t border-zinc-200 pt-4 text-xs text-zinc-400 dark:border-zinc-800">
          Paroles issues du catalogue Pass{"'"}io ({song.meta.source.note ?? "album original"}).
        </p>
      )}
    </div>
  );
}
