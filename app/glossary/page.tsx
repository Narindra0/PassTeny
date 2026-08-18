import type { Metadata } from 'next'
import { listApprovedTerms } from '@/lib/glossary'
import GlossaryForm from '@/components/GlossaryForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Glossaire',
  description: "Le glossaire des ohabolana et expressions de la musique malgache, expliqués par la communauté.",
}

export default async function GlossaryPage() {
  const terms = await listApprovedTerms()

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <span className="eyebrow">
        <i className="fa-solid fa-book" aria-hidden="true" /> Références culturelles
      </span>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">Glossaire</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        Ohabolana, expressions et double-sens de la culture malgache — pour comprendre
        chaque parole.
      </p>

      {terms.length === 0 ? (
        <p className="mt-10 text-sm text-ink-faint">Aucun terme approuvé pour l’instant.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {terms.map((t) => (
            <article
              key={t.id}
              className="card card-hover p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-base font-semibold leading-snug text-ink">« {t.term} »</h2>
                <span className="badge badge-soft-copper shrink-0">{t.language}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{t.meaning}</p>
              {t.example && (
                <p className="mt-3 border-t border-[var(--line)] pt-2 text-xs italic text-ink-soft">
                  <i className="fa-solid fa-quote-right mr-1 text-red" aria-hidden="true" />
                  {t.example}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-12">
        <GlossaryForm />
      </div>
    </div>
  )
}
