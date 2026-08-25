import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthBar from "@/components/AuthBar";
import SearchModal from "@/components/SearchModal";
import SignInModal from "@/components/SignInModal";
import SearchTrigger from "@/components/SearchTrigger";
import RegisterSW from "@/components/RegisterSW";
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
  manifest: "/manifest.json",
  themeColor: "#a63a2b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pass'Teny",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className="h-full antialiased"
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#a63a2b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pass'Teny" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" />
        <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
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
      <body className="flex min-h-full flex-col bg-paper" style={{ overflowX: 'hidden' }}>
        {/* ── Header adaptatif : nav contextuelle par page ── */}
        <Navbar authBar={<AuthBar />} />

        <main className="flex flex-1 flex-col">{children}</main>

        {/* ── Footer : bandeau encre, colonnes mono, miroir du mockup ── */}
        <footer className="mt-20 bg-ink text-paper">
          <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-6 sm:py-14">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
              <div>
                <p className="flex items-center gap-2.5 font-grotesk text-[1.3rem] font-bold tracking-tight text-paper">
                  <span className="lamba-mark on-dark" aria-hidden="true" />
                  Pass<span className="text-red">&apos;</span>Teny
                </p>
                <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-paper/50">
                  Comprendre la musique malgache, parole pour parole.
                  Annotations, glossaire et analyses rédigés par la communauté.
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
            <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-paper/15 pt-5 font-mono text-[11px] uppercase tracking-[0.1em] text-paper/40 sm:flex-row sm:gap-2">
              <p>© {new Date().getFullYear()} Pass&apos;Teny · Ny hevitry ny teny</p>
              <p>Indépendant de Pass&apos;io · Contenu versionné sur GitHub</p>
            </div>
          </div>
        </footer>

        {/* Recherche en modal (remplace la page /search) */}
        <SearchModal />
        {/* Connexion en modal */}
        <SignInModal />
        {/* Enregistrement du service worker PWA */}
        <RegisterSW />
      </body>
    </html>
  );
}
