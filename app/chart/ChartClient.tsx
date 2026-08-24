'use client'

/**
 * Page chart côté client — design complet restauré.
 * Fetch vues, votes, punchlines depuis Supabase (0 CPU Worker).
 */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase/client'
import CoverImage from '@/components/CoverImage'
import ChartTabs, { ChartSection } from '@/components/ChartTabs'
import type { ReactNode } from 'react'

interface SongSummary {
  slug: string
  title: string
  artist: string
  album: string
  coverUrl?: string | null
  annotationCount: number
}

interface Punchline {
  id: string
  songId: string
  quote: string
  score: number
  author: string
  songTitle: string
  artistName: string
}

interface Contributor {
  username: string
  role: string
  reputation: number
  mergedAnnotations: number
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line-strong bg-card px-4 py-3.5">
      <div className="font-grotesk text-2xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">{label}</div>
    </div>
  )
}

function formatViews(n: number): string {
  return `${n.toLocaleString('fr-FR')} vue${n > 1 ? 's' : ''}`
}

export default function ChartClient() {
  const [songs, setSongs] = useState<SongSummary[]>([])
  const [views, setViews] = useState<Map<string, number>>(new Map())
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [punchlines, setPunchlines] = useState<Punchline[]>([])
  const [totalViews, setTotalViews] = useState(0)
  const [mergedCount, setMergedCount] = useState(0)
  const [totalVotes, setTotalVotes] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    async function load() {
      const { data: songsData } = await supabase!.from('songs').select('id, artist_name, title, album')
      const { data: annData } = await supabase!.from('annotations').select('song_id, score, author_id, status')
      const merged = (annData ?? []).filter((a) => a.status === 'merged')
      setMergedCount(merged.length)

      const counts = new Map<string, number>()
      for (const a of merged) { counts.set(a.song_id, (counts.get(a.song_id) ?? 0) + 1) }
      const songList: SongSummary[] = (songsData ?? []).map((s) => ({
        slug: s.id, title: s.title, artist: s.artist_name, album: s.album ?? '', annotationCount: counts.get(s.id) ?? 0,
      }))

      const { count: voteCount } = await supabase!.from('votes').select('annotation_id', { count: 'exact', head: true })
      setTotalVotes(voteCount ?? 0)

      const { data: viewsData } = await supabase!.from('song_views').select('song_id, count')
      const viewMap = new Map<string, number>()
      let total = 0
      for (const v of viewsData ?? []) { viewMap.set(v.song_id, (viewMap.get(v.song_id) ?? 0) + (v.count ?? 0)); total += v.count ?? 0 }
      setViews(viewMap)
      setTotalViews(total)

      const { data: profiles } = await supabase!.from('profiles').select('id, username, role, reputation').gt('reputation', 0).order('reputation', { ascending: false }).limit(20)
      const mergedByAuthor = new Map<string, number>()
      for (const a of merged) { mergedByAuthor.set(a.author_id, (mergedByAuthor.get(a.author_id) ?? 0) + 1) }
      setContributors((profiles ?? []).map((p) => ({ username: p.username, role: p.role, reputation: p.reputation, mergedAnnotations: mergedByAuthor.get(p.id) ?? 0 })))

      const { data: pData } = await supabase!.from('punchlines').select('id, song_id, quote, score, author_id, status').in('status', ['approved', 'pending']).order('score', { ascending: false }).limit(10)
      if (pData && pData.length > 0) {
        const authorIds = [...new Set(pData.map((p) => p.author_id))]
        const songIds = [...new Set(pData.map((p) => p.song_id))]
        const [pr, sr] = await Promise.all([
          supabase!.from('profiles').select('id, username').in('id', authorIds),
          supabase!.from('songs').select('id, title, artist_name').in('id', songIds),
        ])
        const uMap = new Map((pr.data ?? []).map((p) => [p.id, p.username]))
        const sMap = new Map((sr.data ?? []).map((s) => [s.id, { title: s.title, artist: s.artist_name }]))
        setPunchlines(pData.map((p) => ({ id: p.id, songId: p.song_id, quote: p.quote, score: p.score ?? 0, author: uMap.get(p.author_id) ?? 'inconnu', songTitle: sMap.get(p.song_id)?.title ?? '', artistName: sMap.get(p.song_id)?.artist ?? '' })))
      }

      setSongs(songList)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-ink-faint" />
            <p className="mt-3 font-mono text-[11px] text-ink-faint">Chargement du chart…</p>
          </div>
        </div>
      </div>
    )
  }

  const byViews = [...songs].sort((a, b) => (views.get(b.slug) ?? 0) - (views.get(a.slug) ?? 0))
  const viewedPodium = byViews.slice(0, 3)
  const viewedRest = byViews.slice(3, 10)
  const annotatedTop = [...songs].filter((s) => s.annotationCount > 0).sort((a, b) => b.annotationCount - a.annotationCount).slice(0, 10)
  const annotatedPodium = annotatedTop.slice(0, 3)
  const annotatedRest = annotatedTop.slice(3, 10)

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <span className="eyebrow">Le chart</span>
      <h1 className="mt-2 font-grotesk text-3xl font-bold uppercase tracking-tight text-ink sm:text-4xl">Le top du catalogue</h1>
      <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-soft">
        Les titres les plus lus, les annotations les plus votées, les punchlines les plus marquantes — classement vivant.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="titres au catalogue" value={songs.length} />
        <Stat label="vues cumulées" value={totalViews.toLocaleString('fr-FR')} />
        <Stat label="annotations publiées" value={mergedCount} />
        <Stat label="votes émis" value={totalVotes.toLocaleString('fr-FR')} />
      </div>

      <section className="mt-14">
        <ChartTabs>
          {/* ── VUES ── */}
          <ChartSection id="views">
            <div className="space-y-10">
              {viewedPodium.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {viewedPodium.map((s, i) => (
                    <Link key={s.slug} href={`/songs/${s.slug}`} className="rank-card group">
                      <div className="rank-num-big px-4 pt-3">{String(i + 1).padStart(2, '0')}</div>
                      <CoverImage src={s.coverUrl} alt="" size="card" className="relative z-10 mx-auto -mt-4 mb-4 h-[82px] w-[82px] rounded-full border-2 border-card object-cover shadow-[0_0_0_1px_var(--line-strong)]" />
                      <div className="pb-5 text-center">
                        <h3 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">{s.title}</h3>
                        <div className="mt-0.5 text-[12.5px] text-ink-soft">{s.artist}</div>
                        <div className="mt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-red">{formatViews(views.get(s.slug) ?? 0)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {viewedRest.length > 0 && (
                <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
                  {viewedRest.map((song, i) => (
                    <Link key={song.slug} href={`/songs/${song.slug}`} className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5">
                      <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">{String(i + 4).padStart(2, '0')}</span>
                      <CoverImage src={song.coverUrl} alt="" size="thumb" className="h-9 w-9 shrink-0 rounded-[3px] border border-line-strong object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">{song.title}</span>
                        <span className="block truncate text-xs text-ink-faint">{song.artist}{song.album ? ` · ${song.album}` : ''}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-wider text-red">{formatViews(views.get(song.slug) ?? 0)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </ChartSection>

          {/* ── ANNOTATIONS ── */}
          <ChartSection id="annotations">
            <div className="space-y-10">
              {annotatedPodium.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {annotatedPodium.map((s, i) => (
                    <Link key={s.slug} href={`/songs/${s.slug}`} className="rank-card group">
                      <div className="rank-num-big px-4 pt-3">{String(i + 1).padStart(2, '0')}</div>
                      <CoverImage src={s.coverUrl} alt="" size="card" className="relative z-10 mx-auto -mt-4 mb-4 h-[82px] w-[82px] rounded-full border-2 border-card object-cover shadow-[0_0_0_1px_var(--line-strong)]" />
                      <div className="pb-5 text-center">
                        <h3 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">{s.title}</h3>
                        <div className="mt-0.5 text-[12.5px] text-ink-soft">{s.artist}</div>
                        <div className="mt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-mustard-dark">{s.annotationCount} note{s.annotationCount > 1 ? 's' : ''}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {annotatedRest.length > 0 && (
                <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
                  {annotatedRest.map((song, i) => (
                    <Link key={song.slug} href={`/songs/${song.slug}`} className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5">
                      <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">{String(i + 4).padStart(2, '0')}</span>
                      <CoverImage src={song.coverUrl} alt="" size="thumb" className="h-9 w-9 shrink-0 rounded-[3px] border border-line-strong object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">{song.title}</span>
                        <span className="block truncate text-xs text-ink-faint">{song.artist}{song.album ? ` · ${song.album}` : ''}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-wider text-mustard-dark">{song.annotationCount} note{song.annotationCount > 1 ? 's' : ''}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </ChartSection>

          {/* ── PUNCHLINES ── */}
          <ChartSection id="punchlines">
            <div className="space-y-3">
              {punchlines.length > 0 ? punchlines.map((p, i) => (
                <Link key={p.id} href={`/songs/${p.songId}`} className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt sm:px-5">
                  <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm italic text-ink">&laquo;&nbsp;{p.quote}&nbsp;&raquo;</p>
                    <span className="mt-0.5 block text-[11px] text-ink-faint">{p.songTitle} · {p.artistName} · @{p.author}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] font-medium text-green">{p.score > 0 ? '+' : ''}{p.score}</span>
                </Link>
              )) : <p className="text-center py-12 text-sm text-ink-soft">Aucune punchline pour le moment.</p>}
            </div>
          </ChartSection>
        </ChartTabs>
      </section>

      {/* ── Contributeurs ── */}
      <section className="mt-16">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-red">Réputation &amp; contributions</span>
            <h2 className="mt-1 font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">Les voix du catalogue</h2>
          </div>
          {contributors.length > 0 && (
            <span className="rounded-full bg-red/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red">
              {contributors.length} contributeur{contributors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {contributors.length > 0 ? (
          <ul className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
            {contributors.map((c, i) => (
              <li key={c.username} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
                <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red font-grotesk text-sm font-bold text-paper" aria-hidden="true">
                  {c.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-ink">@{c.username}</span>
                    {c.role !== 'contributor' && (
                      <span className="rounded-full border border-mustard bg-mustard/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mustard-dark">
                        {c.role === 'moderator' ? 'modérateur' : 'de confiance'}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{c.mergedAnnotations} annotation{c.mergedAnnotations > 1 ? 's' : ''} publiée{c.mergedAnnotations > 1 ? 's' : ''}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-grotesk text-base font-bold text-ink">{c.reputation.toLocaleString('fr-FR')}</div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">pts</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <span className="lamba-mark" aria-hidden="true" />
            <p className="mt-4 font-grotesk text-xl font-medium italic tracking-tight text-ink">Personne n&apos;a encore contribué</p>
            <Link href="/" className="btn btn-primary btn-sharp mt-5"><i className="fa-solid fa-pen-nib" aria-hidden="true" /> Annoter un titre</Link>
          </div>
        )}
      </section>
    </div>
  )
}
