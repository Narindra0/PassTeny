'use client'

/**
 * Onglets de navigation pour la page Chart.
 *
 * Usage :
 * <ChartTabs>
 *   <ChartSection id="views">...</ChartSection>
 *   <ChartSection id="annotations">...</ChartSection>
 * </ChartTabs>
 */
import { createContext, useContext, useState, type ReactNode } from 'react'

export type ChartTab = 'views' | 'annotations' | 'votes' | 'punchlines'

const TABS: { id: ChartTab; label: string; icon: string }[] = [
  { id: 'views', label: 'Vues', icon: 'fa-solid fa-eye' },
  { id: 'annotations', label: 'Annotations', icon: 'fa-solid fa-pen-nib' },
  { id: 'votes', label: 'Votes', icon: 'fa-solid fa-arrow-up' },
  { id: 'punchlines', label: 'Punchlines', icon: 'fa-solid fa-quote-left' },
]

const ActiveTabContext = createContext<ChartTab>('views')

/** Section qui s'affiche/masque selon l'onglet actif. */
export function ChartSection({ id, children }: { id: ChartTab; children: ReactNode }) {
  const active = useContext(ActiveTabContext)
  if (active !== id) return null
  return <div>{children}</div>
}

export default function ChartTabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ChartTab>('views')

  return (
    <ActiveTabContext.Provider value={active}>
      {/* Barre d'onglets */}
      <div className="mb-8 flex gap-1 overflow-x-auto rounded-xl border border-line-strong bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 font-grotesk text-sm font-semibold transition-all ${
              active === tab.id
                ? 'bg-ink text-paper shadow-sm'
                : 'text-ink-soft hover:bg-paper-alt hover:text-ink'
            }`}
          >
            <i className={`text-xs ${tab.icon}`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sections — celles qui ne matchent pas l'onglet actif ne rendent rien */}
      <div className="relative">
        {children}
      </div>
    </ActiveTabContext.Provider>
  )
}
