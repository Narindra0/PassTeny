import type { Metadata } from "next";
import Link from "next/link";
import AuthBar from "@/components/AuthBar";
import SearchModal from "@/components/SearchModal";
import SearchTrigger from "@/components/SearchTrigger";
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

/** Navigation du header : la page Chart est dédiée, le reste mène aux ancres de la landing. */
const NAV_LINKS = [
  { href: "/#eco", label: "Écosystème" },
  { href: "/chart", label: "Chart" },
  { href: "/#artistes", label: "Artistes" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className="h-full antialiased"
    >
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col bg-paper">
        {/* ── Header : bande drapeau + nav claire, miroir de la landing ── */}
        <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-sm">
          <div className="flagbar" aria-hidden="true">
            <span className="bg-red" />
            <span className="bg-green" />
            <span className="bg-mustard" />
            <span className="bg-ink" />
          </div>
          <div className="relative mx-auto flex h-[68px] w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            {/* Marque */}
            <Link
              href="/"
              className="group inline-flex shrink-0 items-center gap-2.5"
            >
              <span className="lamba-mark transition-transform duration-300 group-hover:rotate-[135deg]" aria-hidden="true" />
              <span className="font-grotesk text-[1.25rem] font-bold tracking-tight text-ink transition-colors group-hover:text-red sm:text-[1.3rem]">
                Pass<span className="text-red">&apos;</span>Teny
              </span>
            </Link>

            {/* Ancres vers les sections de la landing */}
            <nav className="hidden items-center gap-7 lg:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Recherche en pill (masquée sur mobile — bouton loupe absent, la modal reste accessible depuis la landing) */}
            <SearchTrigger
              label="Rechercher un titre, un artiste, une parole"
              className="hidden max-w-xs flex-1 items-center gap-2.5 rounded-full border-[1.5px] border-line-strong bg-card px-4 py-2.5 text-left text-[0.82rem] text-ink-faint transition-colors hover:border-ink md:flex"
            >
              <i className="fa-solid fa-magnifying-glass text-xs" aria-hidden="true" />
              <span className="truncate">Rechercher un titre, un artiste, une parole…</span>
            </SearchTrigger>

            <div className="flex shrink-0 items-center justify-end">
              <AuthBar />
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        {/* ── Footer : bandeau encre, colonnes mono, miroir du mockup ── */}
        <footer className="mt-20 bg-ink text-paper">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
              <div>
                <p className="flex items-center gap-2.5 font-grotesk text-[1.3rem] font-bold tracking-tight text-paper">
                  <span className="lamba-mark on-dark" aria-hidden="true" />
                  Pass<span className="text-red">&apos;</span>Teny
                </p>
                <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-paper/50">
                  Plateforme communautaire d&apos;annotation des lyrics malgaches —
                  proverbes, métaphores et références culturelles expliqués par la communauté.
                </p>
              </div>
              <div>
                <h5 className="mb-3.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-paper/40">
                  Découvrir
                </h5>
                <Link href="/glossary" className="mb-2.5 block text-[13.5px] text-paper/70 transition-colors hover:text-red">
                  Glossaire des ohabolana
                </Link>
                <Link href="/tags" className="mb-2.5 block text-[13.5px] text-paper/70 transition-colors hover:text-red">
                  Thématiques
                </Link>
                <Link href="/chart" className="mb-2.5 block text-[13.5px] text-paper/70 transition-colors hover:text-red">
                  Le chart
                </Link>
                <SearchTrigger
                  label="Rechercher"
                  className="block text-left text-[13.5px] text-paper/70 transition-colors hover:text-red"
                >
                  Recherche
                </SearchTrigger>
              </div>
              <div>
                <h5 className="mb-3.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-paper/40">
                  Écosystème
                </h5>
                <a href="https://player.passiio.shop" target="_blank" rel="noopener noreferrer" className="mb-2.5 block text-[13.5px] text-paper/70 transition-colors hover:text-red">
                  player.passiio.shop ↗
                </a>
                <a href="https://passiio.shop" target="_blank" rel="noopener noreferrer" className="mb-2.5 block text-[13.5px] text-paper/70 transition-colors hover:text-red">
                  passiio.shop ↗
                </a>
                <a href="https://artist.passiio.shop" target="_blank" rel="noopener noreferrer" className="mb-2.5 block text-[13.5px] text-paper/70 transition-colors hover:text-red">
                  artist.passiio.shop ↗
                </a>
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-paper/15 pt-5 font-mono text-[11px] uppercase tracking-[0.1em] text-paper/40 sm:flex-row">
              <p>© {new Date().getFullYear()} Pass&apos;Teny · Ny hevitry ny teny</p>
              <p>Indépendant de Pass&apos;io · Contenu versionné sur GitHub</p>
            </div>
          </div>
        </footer>

        {/* Recherche en modal (remplace la page /search) */}
        <SearchModal />
      </body>
    </html>
  );
}
