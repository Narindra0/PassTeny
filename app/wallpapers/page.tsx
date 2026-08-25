import type { Metadata } from 'next'
import Link from 'next/link'
import { listWallpapers, type Wallpaper } from '@/lib/editorial'
import CoverImage from '@/components/CoverImage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Wallpapers',
  description: 'Fonds d\'écran inspirés du catalogue malgache — covers, paroles et punchlines.',
}

const STYLE_META: Record<Wallpaper['style'], { label: string; bg: string; text: string; border: string }> = {
  dark: { label: 'Dark', bg: 'bg-ink', text: 'text-paper', border: 'border-ink' },
  light: { label: 'Light', bg: 'bg-paper', text: 'text-ink', border: 'border-line-strong' },
  vintage: { label: 'Vintage', bg: 'bg-[#F5E6D3]', text: 'text-[#3D2B1F]', border: 'border-[#C9A96E]' },
  neon: { label: 'Neon', bg: 'bg-[#0D0D0D]', text: 'text-[#E0FF4F]', border: 'border-[#E0FF4F]/30' },
}

/** Carte wallpaper — aperçu + lien vers la page du titre. */
function WallpaperCard({ wallpaper }: { wallpaper: Wallpaper }) {
  const style = STYLE_META[wallpaper.style]

  return (
    <Link
      href={`/songs/${wallpaper.title}`}
      className="group relative overflow-hidden rounded-2xl border border-line-strong bg-card transition-all hover:-translate-y-1 hover:shadow-card"
    >
      {/* Aperçu du wallpaper */}
      <div
        className={`relative aspect-[9/16] w-full overflow-hidden ${style.bg}`}
        style={{ maxHeight: '400px' }}
      >
        {/* Cover en arrière-plan (floutée) */}
        {wallpaper.coverUrl && (
          <div className="absolute inset-0">
            <CoverImage
              src={wallpaper.coverUrl}
              alt=""
              size="card"
              className="h-full w-full object-cover opacity-40 blur-sm transition-transform duration-500 group-hover:scale-110"
            />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-transparent to-ink/60" />

        {/* Contenu */}
        <div className="relative z-10 flex h-full flex-col justify-between p-5">
          {/* Titre en haut */}
          <div>
            <span className={`inline-block rounded-full border ${style.border} px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${style.text} opacity-70`}>
              {style.label}
            </span>
          </div>

          {/* Citation au centre */}
          <div className="flex-1 flex items-center justify-center px-2">
            <p className={`text-center font-display text-lg italic leading-snug ${style.text} drop-shadow-lg`}>
              &laquo;&nbsp;{wallpaper.quote}&nbsp;&raquo;
            </p>
          </div>

          {/* Cover mini + titre en bas */}
          <div className="flex items-center gap-3">
            {wallpaper.coverUrl && (
              <CoverImage
                src={wallpaper.coverUrl}
                alt={wallpaper.title}
                size="thumb"
                className="h-10 w-10 shrink-0 rounded-lg border border-paper/20 object-cover shadow-lg"
              />
            )}
            <div className="min-w-0">
              <span className={`block truncate text-sm font-bold ${style.text}`}>
                {wallpaper.title}
              </span>
              <span className={`block truncate text-[11px] ${style.text} opacity-60`}>
                {wallpaper.artist}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Badge accent color */}
      <div
        className="absolute top-3 right-3 h-3 w-3 rounded-full border-2 border-white/30 shadow-lg"
        style={{ backgroundColor: wallpaper.accent }}
      />

      {/* Hover label */}
      <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors group-hover:bg-ink/20">
        <span className="rounded-full bg-ink/80 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100">
          <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" aria-hidden="true" />
          Voir le titre
        </span>
      </div>
    </Link>
  )
}

export default async function WallpapersPage() {
  const wallpapers = await listWallpapers()

  return (
    <div className="flex-1">
      {/* ══ Hero ══ */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <span className="eyebrow text-red-light">
            <i className="fa-solid fa-image mr-0.5" aria-hidden="true" />
          </span>
          <h1 className="mt-3 font-grotesk text-3xl font-bold uppercase tracking-tight text-paper sm:text-4xl">
            Wallpapers
          </h1>
          <p className="mt-2 max-w-lg text-sm text-paper/60">
            Fonds d&apos;écran inspirés du catalogue — covers stylisées avec les paroles
            qui marquent. Choisissez votre style.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] text-paper/50">
              <i className="fa-solid fa-palette text-[9px] text-red-light" aria-hidden="true" />
              {wallpapers.length} wallpaper{wallpapers.length > 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] text-paper/50">
              <i className="fa-solid fa-paintbrush text-[9px] text-mustard" aria-hidden="true" />
              4 styles
            </span>
          </div>
        </div>
      </section>

      {/* ══ Grille wallpapers ══ */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {wallpapers.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {wallpapers.map((wp) => (
              <WallpaperCard key={wp.id} wallpaper={wp} />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <i className="fa-solid fa-image text-3xl text-ink-faint" aria-hidden="true" />
            <p className="mt-4 font-grotesk text-xl font-medium italic tracking-tight text-ink">
              Bientôt disponibles
            </p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
              Les wallpapers seront générés à partir des covers et punchlines du catalogue.
              Revenez bientôt !
            </p>
          </div>
        )}

        {/* Lien vers le catalogue */}
        <div className="mt-12 text-center">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-red hover:text-red"
          >
            <i className="fa-solid fa-compass text-xs" aria-hidden="true" />
            Explorer le catalogue
          </Link>
        </div>
      </div>
    </div>
  )
}
