'use client'

/**
 * Timeline d'activité récente d'un contributeur.
 * Affiche les dernières actions (annotations, votes, suggestions) en fil chronologique.
 */
import Link from 'next/link'

export interface ActivityItem {
  id: string
  type: 'annotation' | 'vote_received' | 'suggestion' | 'badge_earned'
  title: string
  context?: string
  songSlug?: string
  songTitle?: string
  artistName?: string
  score?: number
  timestamp: string
}

const TYPE_CONFIG: Record<ActivityItem['type'], { icon: string; color: string; label: string }> = {
  annotation: { icon: 'fa-solid fa-pen-nib', color: 'text-red', label: 'Annotation' },
  vote_received: { icon: 'fa-solid fa-arrow-up', color: 'text-green', label: 'Vote reçu' },
  suggestion: { icon: 'fa-solid fa-file-pen', color: 'text-mustard-dark', label: 'Lyrics ajoutés' },
  badge_earned: { icon: 'fa-solid fa-award', color: 'text-mustard', label: 'Badge obtenu' },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin}min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffD < 7) return `il y a ${diffD}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function ActivityEntry({ item }: { item: ActivityItem }) {
  const config = TYPE_CONFIG[item.type]

  return (
    <div className="group flex gap-3">
      {/* Ligne verticale + icône */}
      <div className="flex flex-col items-center">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card text-xs ${config.color} transition-colors group-hover:border-ink`}>
          <i className={config.icon} aria-hidden="true" />
        </span>
        <div className="w-px flex-1 bg-line" />
      </div>

      {/* Contenu */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug text-ink">
            {item.type === 'annotation' && (
              <>
                A annoté{' '}
                {item.songSlug ? (
                  <Link href={`/songs/${item.songSlug}`} className="font-semibold text-red transition-colors hover:underline">
                    {item.songTitle}
                  </Link>
                ) : (
                  <span className="font-semibold">{item.title}</span>
                )}
                {item.artistName && <span className="text-ink-soft"> · {item.artistName}</span>}
              </>
            )}
            {item.type === 'vote_received' && (
              <>
                A reçu un vote sur son annotation de{' '}
                {item.songSlug ? (
                  <Link href={`/songs/${item.songSlug}`} className="font-semibold text-red transition-colors hover:underline">
                    {item.songTitle}
                  </Link>
                ) : (
                  <span className="font-semibold">{item.title}</span>
                )}
              </>
            )}
            {item.type === 'suggestion' && (
              <>
                A ajouté les lyrics de{' '}
                {item.songSlug ? (
                  <Link href={`/songs/${item.songSlug}`} className="font-semibold text-red transition-colors hover:underline">
                    {item.songTitle}
                  </Link>
                ) : (
                  <span className="font-semibold">{item.title}</span>
                )}
                {item.artistName && <span className="text-ink-soft"> · {item.artistName}</span>}
              </>
            )}
            {item.type === 'badge_earned' && (
              <>
                A obtenu le badge « <span className="font-semibold text-mustard-dark">{item.title}</span> »
              </>
            )}
          </p>
          <span className="shrink-0 font-mono text-[10px] text-ink-faint">
            {timeAgo(item.timestamp)}
          </span>
        </div>

        {/* Citation de l'annotation */}
        {item.type === 'annotation' && item.context && (
          <blockquote className="mt-1.5 border-l-2 border-red/30 pl-2 font-display text-xs italic text-ink-soft">
            « {item.context.length > 100 ? item.context.slice(0, 100) + '…' : item.context} »
          </blockquote>
        )}
      </div>
    </div>
  )
}

export default function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-ink-soft">
        Aucune activité récente.
      </p>
    )
  }

  return (
    <div className="relative">
      {items.map((item) => (
        <ActivityEntry key={item.id} item={item} />
      ))}
    </div>
  )
}
