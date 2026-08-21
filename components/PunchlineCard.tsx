'use client'

/**
 * Carte punchline avec vote ±1.
 * Optimistic update : le score change instantanément avant la réponse serveur.
 */
import { useState } from 'react'
import Link from 'next/link'
import { openSignIn } from '@/components/SignInModal'

interface PunchlineCardProps {
  id: string
  quote: string
  body: string
  score: number
  myVote: 1 | -1 | 0
  author: string
  songId: string
  songTitle: string
  artistName: string
  tags: string[]
  index?: number
}

export default function PunchlineCard({
  id,
  quote,
  body,
  score: initialScore,
  myVote: initialMyVote,
  author,
  songId,
  songTitle,
  artistName,
  tags,
  index = 0,
}: PunchlineCardProps) {
  const [score, setScore] = useState(initialScore)
  const [myVote, setMyVote] = useState<1 | -1 | 0>(initialMyVote)
  const [voting, setVoting] = useState(false)

  async function handleVote(value: 1 | -1) {
    // Si même vote → on retire
    const newValue = myVote === value ? 0 : value
    const prevScore = score
    const prevMyVote = myVote

    // Optimistic update
    setScore((s) => s - prevMyVote + newValue)
    setMyVote(newValue)
    setVoting(true)

    try {
      const res = await fetch('/api/punchlines/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ punchlineId: id, value: newValue }),
      })
      if (res.status === 401) {
        openSignIn()
        setScore(prevScore)
        setMyVote(prevMyVote)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setScore(data.score)
        setMyVote(data.myVote)
      } else {
        setScore(prevScore)
        setMyVote(prevMyVote)
      }
    } catch {
      setScore(prevScore)
      setMyVote(prevMyVote)
    } finally {
      setVoting(false)
    }
  }

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-line-strong bg-card transition-all hover:-translate-y-0.5 hover:shadow-card"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Bande latérale accent */}
      <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-red to-mustard opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex gap-3 p-5">
        {/* Vote controls */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => handleVote(1)}
            disabled={voting}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
              myVote === 1
                ? 'border-green bg-green/10 text-green'
                : 'border-line-strong text-ink-faint hover:border-green hover:text-green'
            }`}
            aria-label="Vote positif"
          >
            <i className="fa-solid fa-arrow-up text-xs" aria-hidden="true" />
          </button>

          <span className={`font-grotesk text-sm font-bold tabular-nums ${
            score > 0 ? 'text-green' : score < 0 ? 'text-red' : 'text-ink-faint'
          }`}>
            {score}
          </span>

          <button
            type="button"
            onClick={() => handleVote(-1)}
            disabled={voting}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
              myVote === -1
                ? 'border-red bg-red/10 text-red'
                : 'border-line-strong text-ink-faint hover:border-red hover:text-red'
            }`}
            aria-label="Vote négatif"
          >
            <i className="fa-solid fa-arrow-down text-xs" aria-hidden="true" />
          </button>
        </div>

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <Link href={`/songs/${songId}`} className="block">
            <blockquote className="border-l-[3px] border-red/30 pl-3">
              <p className="font-display text-[15px] font-medium italic leading-relaxed text-ink transition-colors group-hover:text-red">
                « {quote} »
              </p>
            </blockquote>
          </Link>

          {body && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft line-clamp-2">
              {body}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <div className="min-w-0">
              <Link href={`/songs/${songId}`} className="block truncate text-xs font-bold text-ink transition-colors hover:text-red">
                {songTitle}
              </Link>
              <span className="block truncate text-[11px] text-ink-faint">{artistName}</span>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-ink-faint">@{author}</span>
          </div>

          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-paper-deep px-1.5 py-0.5 font-mono text-[9px] font-semibold text-red">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
