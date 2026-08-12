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
      <h1 className="text-3xl font-bold tracking-tight">Glossaire</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-500">
        Ohabolana, expressions et double-sens de la culture malgache — pour comprendre
        chaque parole.
      </p>

      {terms.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">Aucun terme approuvé pour l’instant.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {terms.map((t) => (
            <article
              key={t.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold leading-snug">« {t.term} »</h2>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                  {t.language}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{t.meaning}</p>
              {t.example && (
                <p className="mt-3 border-t border-zinc-100 pt-2 text-xs italic text-zinc-500 dark:border-zinc-800">
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
