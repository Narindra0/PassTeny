import type { Metadata } from 'next'
import Link from 'next/link'
import { listTopPunchlines } from '@/lib/punchlines'
import { getSessionUser } from '@/lib/auth'
import PunchlineCard from '@/components/PunchlineCard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Punchlines',
  description: "Les meilleures paroles annotées de la musique malgache, expliquées par la communauté.",
}

export default async function GlossaryPage() {
  const user = await getSessionUser()
  const punchlines = await listTopPunchlines(16, user?.id)

  return (
    <div className="flex-1">
      {/* ══ Hero éditorial — fond encre ══ */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <span className="eyebrow text-red-light">
            <i className="fa-solid fa-quote-left mr-0.5" aria-hidden="true" /> Les paroles qui marquent
          </span>

          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
            Punchlines
          </h1>

          <p className="mt-4 max-w-lg text-[0.95rem] leading-relaxed text-paper/65">
            Les lignes les plus puissantes du catalogue malgache — sélectionnées et votées
            par la communauté, expliquées par celles et ceux qui les comprennent.
          </p>

          <blockquote className="mt-8 max-w-md border-l-[3px] border-red-light pl-4">
            <p className="font-display text-lg italic leading-relaxed text-paper/80">
              « Ny teny no valin-teny, fa tsy ny hazo. »
            </p>
            <cite className="mt-2 block font-mono text-[10px] not-italic uppercase tracking-[0.15em] text-paper/40">
              — Ohabolana malgache
            </cite>
          </blockquote>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-paper/15 px-3.5 py-1.5 font-mono text-[11px] text-paper/60">
              <i className="fa-solid fa-quote-left text-[10px] text-red-light" aria-hidden="true" />
              {punchlines.length} punchline{punchlines.length > 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-paper/15 px-3.5 py-1.5 font-mono text-[11px] text-paper/60">
              <i className="fa-solid fa-check-double text-[10px] text-mustard" aria-hidden="true" />
              votées par la communauté
            </span>
          </div>
        </div>
      </section>

      {/* ══ Mur de punchlines avec vote ══ */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {punchlines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
            <i className="fa-solid fa-quote-left text-4xl text-ink-faint/30" aria-hidden="true" />
            <p className="mt-4 text-sm text-ink-soft">
              Aucune punchline pour l&apos;instant.
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Ouvrez un titre et proposez la ligne qui vous a marqué.
            </p>
            <Link href="/" className="btn btn-primary btn-sm mt-5">
              <i className="fa-solid fa-compass" aria-hidden="true" /> Découvrir le catalogue
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {punchlines.map((p, i) => (
              <PunchlineCard
                key={p.id}
                id={p.id}
                quote={p.quote}
                body={p.body}
                score={p.score}
                myVote={p.myVote}
                author={p.author}
                songId={p.songId}
                songTitle={p.songTitle}
                artistName={p.artistName}
                tags={p.tags}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
