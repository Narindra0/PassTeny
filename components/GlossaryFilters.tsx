'use client'

/**
 * Glossaire filtrable — recherche + navigation alphabétique + cartes culturelles.
 * Chaque terme est présenté comme un petit recueil, pas juste une carte générique.
 */
import { useMemo, useState } from 'react'

interface GlossaryTerm {
  id: string
  term: string
  meaning: string
  language: string
  example: string | null
  approved: boolean
  created_at: string
}

/** Premiere lettre du terme en gros, style lettrine de recueil. */
function TermInitial({ letter }: { letter: string }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red/8 font-display text-xl font-semibold text-red"
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}

export default function GlossaryFilters({ terms }: { terms: GlossaryTerm[] }) {
  const [query, setQuery] = useState('')
  const [activeLetter, setActiveLetter] = useState<string | null>(null)

  const availableLetters = useMemo(() => {
    const letters = new Set(terms.map((t) => t.term.charAt(0).toUpperCase()))
    return [...letters].sort()
  }, [terms])

  const filtered = useMemo(() => {
    let result = terms
    if (activeLetter) {
      result = result.filter((t) => t.term.charAt(0).toUpperCase() === activeLetter)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.meaning.toLowerCase().includes(q) ||
          (t.example && t.example.toLowerCase().includes(q))
      )
    }
    return result
  }, [terms, query, activeLetter])

  return (
    <div>
      {/* Barre de recherche */}
      <div className="relative">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-ink-faint" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un ohabolana, une expression…"
          className="input pl-10 py-3 text-[15px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            aria-label="Effacer"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation alphabétique + compteur */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveLetter(null)}
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all ${
              activeLetter === null
                ? 'bg-ink text-paper'
                : 'text-ink-faint hover:bg-paper-deep hover:text-ink'
            }`}
          >
            Tout
          </button>
          {availableLetters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all ${
                activeLetter === letter
                  ? 'bg-ink text-paper'
                  : 'text-ink-faint hover:bg-paper-deep hover:text-ink'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
        <span className="shrink-0 font-mono text-[11px] text-ink-faint">
          {filtered.length} terme{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Grille de termes */}
      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
            <i className="fa-solid fa-book-open text-3xl text-ink-faint/50" aria-hidden="true" />
            <p className="mt-4 text-sm text-ink-soft">
              {query ? (
                <>Aucun résultat pour « <strong>{query}</strong> ».</>
              ) : (
                <>Aucun terme pour la lettre « <strong>{activeLetter}</strong> ».</>
              )}
            </p>
            <button
              type="button"
              onClick={() => { setQuery(''); setActiveLetter(null) }}
              className="mt-3 text-xs font-medium text-red hover:underline"
            >
              Voir tous les termes
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t, i) => (
              <article
                key={t.id}
                className="group overflow-hidden rounded-xl border border-line-strong bg-card transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="flex gap-4 p-5">
                  {/* Lettrine */}
                  <TermInitial letter={t.term.charAt(0).toUpperCase()} />

                  <div className="min-w-0 flex-1">
                    {/* Terme en display + langue */}
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold leading-snug text-ink transition-colors group-hover:text-red">
                        {t.term}
                      </h2>
                      <span className="shrink-0 rounded-full border border-mustard/30 bg-mustard/8 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-mustard-dark">
                        {t.language === 'mg' ? 'Malgache' : t.language === 'fr' ? 'Français' : t.language}
                      </span>
                    </div>

                    {/* Signification */}
                    <p className="mt-2 text-sm leading-relaxed text-ink">{t.meaning}</p>

                    {/* Exemple d'usage */}
                    {t.example && (
                      <div className="mt-3 rounded-lg bg-paper-alt/60 px-3.5 py-2.5">
                        <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.18em] text-red/60">
                          <i className="fa-solid fa-quote-left mr-1" aria-hidden="true" />
                          Usage
                        </span>
                        <p className="mt-1 text-[13px] italic leading-relaxed text-ink-soft">
                          « {t.example} »
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bande latérale décorative — accent lamba */}
                <div className="h-[3px] bg-gradient-to-r from-red/40 via-transparent to-mustard/40 opacity-0 transition-opacity group-hover:opacity-100" />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
