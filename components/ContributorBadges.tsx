'use client'

/**
 * Badges de contribution — récompenses visuelles pour les contributeurs.
 * Logique shared dans lib/badges.ts (importable server + client).
 */
import type { Badge } from '@/lib/badges'

const COLOR_MAP: Record<Badge['color'], { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red/10', text: 'text-red', border: 'border-red/25' },
  mustard: { bg: 'bg-mustard/10', text: 'text-mustard-dark', border: 'border-mustard/25' },
  green: { bg: 'bg-green/10', text: 'text-green', border: 'border-green/25' },
  ink: { bg: 'bg-ink/5', text: 'text-ink', border: 'border-ink/20' },
}

function BadgeChip({ badge }: { badge: Badge }) {
  const c = COLOR_MAP[badge.color]
  return (
    <div
      className={`group relative inline-flex items-center gap-2 rounded-full border ${c.border} ${c.bg} px-3 py-1.5 transition-all hover:scale-105`}
      title={badge.description}
    >
      <i className={`text-xs ${c.text} ${badge.icon}`} aria-hidden="true" />
      <span className={`text-xs font-semibold ${c.text}`}>{badge.label}</span>

      {/* Tooltip */}
      <span className="pointer-events-none absolute -bottom-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {badge.description}
      </span>
    </div>
  )
}

export default function ContributorBadges({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <BadgeChip key={badge.id} badge={badge} />
      ))}
    </div>
  )
}
