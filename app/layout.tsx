import type { Metadata } from "next";
import Link from "next/link";
import AuthBar from "@/components/AuthBar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pass'Teny — Ny hevitry ny teny",
    template: "%s · Pass'Teny",
  },
  description:
    "La plateforme communautaire d'explication et d'annotation des lyrics de la musique malgache. Comprendre chaque parole.",
  keywords: ["Pass'Teny", "lyrics", "paroles", "musique malgache", "annotations", "ohabolana"],
  openGraph: {
    type: "website",
    locale: "fr_MG",
    siteName: "Pass'Teny",
    title: "Pass'Teny — Ny hevitry ny teny",
    description: "Comprendre chaque parole de la musique malgache.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Pass<span className="text-amber-500">{"'"}</span>Teny
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 md:block">
                Ny hevitry ny teny
              </span>
              <AuthBar />
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <p>Pass{"'"}Teny — plateforme communautaire d{"'"}annotation des lyrics malgaches.</p>
          <p className="mt-1">Indépendant de Pass{"'"}io · Contenu versionné sur GitHub.</p>
        </footer>
      </body>
    </html>
  );
}
