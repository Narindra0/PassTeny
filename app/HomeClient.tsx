'use client'

/**
 * Page d'accueil côté client — fetch tout depuis Supabase dans le navigateur.
 * 0 CPU Worker : le Worker sert le HTML pré-généré, React hydrate + fetch.
 */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase/client'
import CoverImage from '@/components/CoverImage'
import SearchTrigger from '@/components/SearchTrigger'

interface SongSummary {
  slug: string
  artistSlug: string
  title: string
  artist: string
  album: string
  coverUrl?: string | null
  annotationCount: number
}

interface ArtistSummary {
  slug: string
  name: string
  coverUrl?: string | null
  songCount: number
}

export default function HomeClient() {
  const [songs, setSongs] = useState<SongSummary[]>([])
  const [artists, setArtists] = useState<ArtistSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }

    async function load() {
      // 1. Songs depuis Supabase
      const { data: songsData } = await supabase!
        .from('songs')
        .select('id, artist_slug, artist_name, title, album')

      // 2. Annotations merged (pour compter)
      const { data: annData } = await supabase!
        .from('annotations')
        .select('song_id')
        .eq('status', 'merged')

      const counts = new Map<string, number>()
      for (const a of annData ?? []) {
        counts.set(a.song_id, (counts.get(a.song_id) ?? 0) + 1)
      }

      const songList: SongSummary[] = (songsData ?? []).map((s) => ({
        slug: s.id,
        artistSlug: s.artist_slug,
        title: s.title,
        artist: s.artist_name,
        album: s.album ?? '',
        annotationCount: counts.get(s.id) ?? 0,
      }))

      // 3. Artistes (aggrégés depuis les songs)
      const artistMap = new Map<string, ArtistSummary>()
      for (const s of songList) {
        const existing = artistMap.get(s.artistSlug)
        if (existing) {
          existing.songCount++
        } else {
          artistMap.set(s.artistSlug, {
            slug: s.artistSlug,
            name: s.artist,
            songCount: 1,
          })
        }
      }
      const artistList = [...artistMap.values()]

      setSongs(songList)
      setArtists(artistList)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-ink-faint" />
      </div>
    )
  }

  const annotatedCount = songs.filter((s) => s.annotationCount > 0).length
  const chart = [...songs].sort((a, b) => b.annotationCount - a.annotationCount)
  const top = chart.slice(0, 5)
  const podium = top.slice(0, 3)
  const topRest = top.slice(3)
  const discoverSongs = songs.filter((s) => !top.some((t) => t.slug === s.slug)).slice(0, 12)
  const progressPct = songs.length ? Math.round((annotatedCount / songs.length) * 100) : 0

  // Albums
  const albumMap = new Map<string, { album: string; artist: string; artistSlug: string; songCount: number }>()
  for (const s of songs) {
    const key = `${s.album}__${s.artistSlug}`
    const cur = albumMap.get(key) ?? { album: s.album, artist: s.artist, artistSlug: s.artistSlug, songCount: 0 }
    cur.songCount++
    albumMap.set(key, cur)
  }
  const albumList = [...albumMap.values()].sort((a, b) => b.songCount - a.songCount)

  return (
    <div className="flex-1">
      {/* Hero */}
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <section>
          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div>
              <span className="eyebrow">
                <i className="fa-solid fa-users mr-0.5" /> Annoté par la communauté malgache
              </span>
              <h1 className="hero-title mt-5 text-ink">
                Ny hevitry ny <em className="serif-accent text-red">teny</em>
              </h1>
              <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed text-ink-soft">
                Le sens caché de chaque parole malgache — <strong className="font-semibold text-ink">ohabolana</strong>, métaphores, références — surligné, expliqué, débattu par ceux qui l&apos;ont vécu.
              </p>
              <div className="mt-7 flex max-w-md gap-2.5">
                <SearchTrigger label="Rechercher" className="flex flex-1 items-center gap-3 rounded-[3px] border-[1.5px] border-line-strong bg-card px-4 py-3.5 text-left text-sm text-ink-faint transition-colors hover:border-ink">
                  <i className="fa-solid fa-magnifying-glass text-sm" />
                  <span className="truncate">Rechercher un titre, un artiste…</span>
                </SearchTrigger>
              </div>
            </div>

            {/* Titre du jour = premier du chart */}
            {podium[0] && (
              <Link href={`/songs/${podium[0].slug}`} className="featured group">
                <div className="featured-top">
                  <span className="eyebrow"><i className="fa-solid fa-star" /> Titre du jour</span>
                </div>
                <div className="p-6 sm:p-7">
                  <div className="flex items-center gap-3.5">
                    <div className="h-14 w-14 shrink-0 rounded-[4px] bg-paper/10" />
                    <div className="min-w-0">
                      <div className="truncate font-grotesk text-xl font-bold text-ink">{podium[0].title}</div>
                      <div className="mt-0.5 font-mono text-xs text-ink-faint">{podium[0].artist}</div>
                    </div>
                  </div>
                  <div className="mt-5 font-mono text-xs text-red">
                    {podium[0].annotationCount > 0
                      ? `${podium[0].annotationCount} annotations`
                      : 'À annoter'}
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Écosystème */}
      <section className="mt-20 bg-ink text-paper">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="font-grotesk text-2xl font-bold uppercase tracking-tight text-paper sm:text-3xl">L&apos;écosystème Pass&apos;io</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-paper/15 bg-paper/15 sm:grid-cols-3">
            <div className="bg-ink p-7">
              <h3 className="font-grotesk text-xl font-bold text-paper">Pass&apos;io</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-paper/60">Streaming du catalogue malgache.</p>
            </div>
            <div className="bg-red-dark p-7">
              <h3 className="font-grotesk text-xl font-bold text-white">Pass&apos;Teny</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">Le sens des paroles, annoté par la communauté.</p>
              <span className="mt-4 inline-block font-mono text-xs font-semibold text-white">Vous êtes ici</span>
            </div>
            <div className="bg-ink p-7">
              <h3 className="font-grotesk text-xl font-bold text-paper">Espace artiste</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-paper/60">Profil, musique, gestion.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Top catalogue */}
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <section className="mt-20">
          <h2 className="font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">Le top du catalogue</h2>
          <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {podium.map((s, i) => (
              <Link key={s.slug} href={`/songs/${s.slug}`} className="rank-card group">
                <div className="rank-num-big px-4 pt-3">{String(i + 1).padStart(2, '0')}</div>
                <div className="pb-5 text-center">
                  <h4 className="truncate px-3 font-grotesk text-[17px] font-bold text-ink transition-colors group-hover:text-red">{s.title}</h4>
                  <div className="mt-0.5 text-[12.5px] text-ink-soft">{s.artist}</div>
                  <div className="mt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-red">
                    {s.annotationCount > 0 ? `${s.annotationCount} notes` : 'à annoter'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Artistes */}
        <section className="mt-20">
          <h2 className="font-grotesk text-2xl font-bold uppercase tracking-tight text-ink">Artistes</h2>
          <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-7">
            {artists.map((a) => (
              <Link key={a.slug} href={`/artists/${a.slug}`} className="group text-center">
                <div className="mx-auto mb-2.5 w-full max-w-[88px] aspect-square rounded-full bg-ink/5" />
                <div className="truncate text-[13.5px] font-bold text-ink transition-colors group-hover:text-red">{a.name}</div>
                <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">{a.songCount} TITRE{a.songCount > 1 ? 'S' : ''}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
