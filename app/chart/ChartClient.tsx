'use client'

/**
 * Page chart côté client — fetch vues, votes, punchlines depuis Supabase.
 * 0 CPU Worker.
 */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase/client'
import ChartTabs, { ChartSection } from '@/components/ChartTabs'

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
      // Songs
      const { data: songsData } = await supabase!.from('songs').select('id, artist_name, title, album')
      const songList: SongSummary[] = (songsData ?? []).map((s) => ({
        slug: s.id, title: s.title, artist: s.artist_name, album: s.album ?? '', annotationCount: 0,
      }))

      // Annotations merged
      const { data: annData } = await supabase!.from('annotations').select('song_id, score, author_id, status')
      const merged = (annData ?? []).filter((a) => a.status === 'merged')
      setMergedCount(merged.length)

      const counts = new Map<string, number>()
      for (const a of merged) { counts.set(a.song_id, (counts.get(a.song_id) ?? 0) + 1) }
      for (const s of songList) { s.annotationCount = counts.get(s.slug) ?? 0 }

      // Votes
      const { count: voteCount } = await supabase!.from('votes').select('annotation_id', { count: 'exact', head: true })
      setTotalVotes(voteCount ?? 0)

      // Views
      const { data: viewsData } = await supabase!.from('song_views').select('song_id, count')
      const viewMap = new Map<string, number>()
      let total = 0
      for (const v of viewsData ?? []) {
        viewMap.set(v.song_id, (viewMap.get(v.song_id) ?? 0) + (v.count ?? 0))
        total += v.count ?? 0
      }
      setViews(viewMap)
      setTotalViews(total)

      // Top voted songs
      const bySong = new Map<string, { totalVotes: number; count: number }>()
      for (const a of merged) {
        const prev = bySong.get(a.song_id) ?? { totalVotes: 0, count: 0 }
        bySong.set(a.song_id, { totalVotes: prev.totalVotes + (a.score ?? 0), count: prev.count + 1 })
      }

      // Contributors
      const { data: profiles } = await supabase!.from('profiles').select('id, username, role, reputation').gt('reputation', 0).order('reputation', { ascending: false }).limit(20)
      const mergedByAuthor = new Map<string, number>()
      for (const a of merged) { mergedByAuthor.set(a.author_id, (mergedByAuthor.get(a.author_id) ?? 0) + 1) }
      setContributors((profiles ?? []).map((p) => ({
        username: p.username, role: p.role, reputation: p.reputation, mergedAnnotations: mergedByAuthor.get(p.id) ?? 0,
      })))

      // Punchlines
      const { data: pData } = await supabase!.from('punchlines').select('id, song_id, quote, score, author_id, status').in('status', ['approved', 'pending']).order('score', { ascending: false }).limit(10)
      if (pData && pData.length > 0) {
        const authorIds = [...new Set(pData.map((p) => p.author_id))]
        const songIds = [...new Set(pData.map((p) => p.song_id))]
        const [profilesRes, songsRes] = await Promise.all([
          supabase!.from('profiles').select('id, username').in('id', authorIds),
          supabase!.from('songs').select('id, title, artist_name').in('id', songIds),
        ])
        const usernameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.username]))
        const songMap = new Map((songsRes.data ?? []).map((s) => [s.id, { title: s.title, artist: s.artist_name }]))
        setPunchlines(pData.map((p) => ({
          id: p.id, songId: p.song_id, quote: p.quote, score: p.score ?? 0,
          author: usernameMap.get(p.author_id) ?? 'inconnu',
          songTitle: songMap.get(p.song_id)?.title ?? '', artistName: songMap.get(p.song_id)?.artist ?? '',
        })))
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
          <i className="fa-solid fa-spinner fa-spin text-2xl text-ink-faint" />
        </div>
      </div>
    )
  }

  const byViews = [...songs].sort((a, b) => (views.get(b.slug) ?? 0) - (views.get(a.slug) ?? 0))
  const viewedPodium = byViews.slice(0, 3)
  const viewedRest = byViews.slice(3, 10)

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <span className="eyebrow">Le chart</span>
      <h1 className="mt-2 font-grotesk text-3xl font-bold uppercase tracking-tight text-ink sm:text-4xl">Le top du catalogue</h1>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="titres" value={songs.length} />
        <Stat label="vues cumulées" value={totalViews} />
        <Stat label="annotations" value={mergedCount} />
        <Stat label="votes émis" value={totalVotes} />
      </div>

      <section className="mt-14">
        <ChartTabs>
          <ChartSection id="views">
            <div className="space-y-10">
              {viewedPodium.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {viewedPodium.map((s, i) => (
                    <Link key={s.slug} href={`/songs/${s.slug}`} className="rank-card group">
                      <div className="rank-num-big px-4 pt-3">{String(i + 1).padStart(2, '0')}</div>
                      <div className="pb-5 text-center">
                        <h3 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">{s.title}</h3>
                        <div className="mt-0.5 text-[12.5px] text-ink-soft">{s.artist}</div>
                        <div className="mt-2.5 font-mono text-[10px] font-medium uppercase text-red">{(views.get(s.slug) ?? 0).toLocaleString('fr-FR')} vues</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {viewedRest.length > 0 && (
                <div className="overflow-hidden rounded-[6px] border border-line-strong bg-card">
                  {viewedRest.map((song, i) => (
                    <Link key={song.slug} href={`/songs/${song.slug}`} className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt">
                      <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">{String(i + 4).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-red">{song.title}</span>
                        <span className="block truncate text-xs text-ink-faint">{song.artist}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase text-red">{(views.get(song.slug) ?? 0).toLocaleString('fr-FR')}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </ChartSection>

          <ChartSection id="punchlines">
            {punchlines.length > 0 ? (
              <div className="space-y-3">
                {punchlines.map((p, i) => (
                  <Link key={p.id} href={`/songs/${p.songId}`} className="group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-alt">
                    <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm italic text-ink">&laquo;&nbsp;{p.quote}&nbsp;&raquo;</p>
                      <span className="mt-0.5 block text-[11px] text-ink-faint">{p.songTitle} · {p.artistName}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] font-medium text-green">{p.score > 0 ? '+' : ''}{p.score}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center py-12 text-sm text-ink-soft">Aucune punchline pour le moment.</p>
            )}
          </ChartSection>
        </ChartTabs>
      </section>

      {/* Contributeurs */}
      <section className="mt-16">
        <h2 className="font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">Les voix du catalogue</h2>
        {contributors.length > 0 ? (
          <ul className="mt-5 overflow-hidden rounded-[6px] border border-line-strong bg-card">
            {contributors.map((c, i) => (
              <li key={c.username} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
                <span className="w-[26px] shrink-0 font-grotesk text-base font-bold text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-ink">@{c.username}</span>
                  <span className="ml-2 text-xs text-ink-faint">{c.mergedAnnotations} annotations</span>
                </span>
                <span className="font-grotesk text-base font-bold text-ink">{c.reputation.toLocaleString('fr-FR')} pts</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Personne n&apos;a encore contribué.</p>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line-strong bg-card px-4 py-3.5">
      <div className="font-grotesk text-2xl font-bold tracking-tight text-ink">{value.toLocaleString('fr-FR')}</div>
      <div className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">{label}</div>
    </div>
  )
}
