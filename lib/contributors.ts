/**
 * Profils contributeurs — données des pages publiques /contributors/<username>.
 *
 * Un contributeur = un profil Supabase avec de la réputation (> 0) : ses
 * annotations publiées (merged) avec le contexte de chanson, ses suggestions
 * de lyrics publiées, et ses compteurs de votes.
 */
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getContributionStats } from '@/lib/reputation'
import type { Profile } from '@/lib/profiles'

/** Une annotation publiée, avec le contexte de son titre. */
export interface PublishedAnnotation {
  id: string
  songId: string
  songTitle: string
  artistName: string
  album: string | null
  quote: string
  body: string
  tags: string[]
  score: number
  createdAt: string
}

/** Une suggestion de lyrics publiée (merged). */
export interface PublishedSuggestion {
  id: string
  songSlug: string
  trackTitle: string
  artistName: string
  albumTitle: string | null
  coverUrl: string | null
  lyricsPreview: string
  status: string
  createdAt: string
}

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

export interface ContributorPageData {
  profile: Profile & { created_at: string }
  stats: {
    merged: number
    votesReceived: number
    votesCast: number
    accountAgeDays: number
    lyricSuggestionsMerged: number
    lyricSuggestionsPending: number
  }
  annotations: PublishedAnnotation[]
  suggestions: PublishedSuggestion[]
  activity: ActivityItem[]
}

const PROFILE_COLS =
  'id, username, display_name, github_handle, facebook_url, instagram_url, role, reputation, created_at'

/** Données complètes d'un contributeur, par username (null si inconnu). */
export async function getContributorByUsername(username: string): Promise<ContributorPageData | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const { data: profile } = await admin
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('username', username)
    .maybeSingle()
  if (!profile) return null

  const stats = await getContributionStats(profile.id)

  // Annotations publiées + contexte des titres (jointure manuelle, pas de N+1).
  const { data: annotations } = await admin
    .from('annotations')
    .select('id, song_id, quote, body, tags, score, created_at')
    .eq('author_id', profile.id)
    .eq('status', 'merged')
    .order('created_at', { ascending: false })
    .limit(50)

  const songIds = [...new Set((annotations ?? []).map((a) => a.song_id))]
  const { data: songs } =
    songIds.length > 0
      ? await admin.from('songs').select('id, title, artist_name, album').in('id', songIds)
      : { data: [] }
  const songById = new Map((songs ?? []).map((s) => [s.id, s]))

  // Suggestions de lyrics (tous statuts pour voir l'héritage complet).
  const { data: suggestions } = await admin
    .from('lyric_suggestions')
    .select('id, song_slug, track_title, artist_name, album_title, cover_url, lyrics, status, created_at')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30)

  // ── Activité récente : fusion annotations + suggestions + votes, triés par date ──
  const activity: ActivityItem[] = [
    ...(annotations ?? []).slice(0, 15).map((a) => {
      const song = songById.get(a.song_id)
      return {
        id: `ann-${a.id}`,
        type: 'annotation' as const,
        title: song?.title ?? a.song_id,
        context: a.quote,
        songSlug: a.song_id,
        songTitle: song?.title,
        artistName: song?.artist_name,
        score: a.score,
        timestamp: a.created_at,
      }
    }),
    ...(suggestions ?? []).slice(0, 10).map((s) => ({
      id: `sug-${s.id}`,
      type: 'suggestion' as const,
      title: s.track_title,
      songSlug: s.song_slug,
      songTitle: s.track_title,
      artistName: s.artist_name,
      timestamp: s.created_at,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20)

  return {
    profile: profile as Profile & { created_at: string },
    stats: {
      merged: stats.merged,
      votesReceived: stats.votesReceived,
      votesCast: stats.votesCast,
      accountAgeDays: stats.accountAgeDays,
      lyricSuggestionsMerged: suggestions?.filter((s) => s.status === 'merged').length ?? 0,
      lyricSuggestionsPending: suggestions?.filter((s) => s.status === 'pending').length ?? 0,
    },
    annotations: (annotations ?? []).map((a) => {
      const song = songById.get(a.song_id)
      return {
        id: a.id,
        songId: a.song_id,
        songTitle: song?.title ?? a.song_id,
        artistName: song?.artist_name ?? '',
        album: song?.album ?? null,
        quote: a.quote,
        body: a.body,
        tags: a.tags ?? [],
        score: a.score,
        createdAt: a.created_at,
      }
    }),
    suggestions: (suggestions ?? []).map((s) => ({
      id: s.id,
      songSlug: s.song_slug,
      trackTitle: s.track_title,
      artistName: s.artist_name,
      albumTitle: s.album_title ?? null,
      coverUrl: s.cover_url ?? null,
      lyricsPreview: (s.lyrics ?? '').split('\n').filter((l: string) => l.trim()).slice(0, 3).join(' / '),
      status: s.status,
      createdAt: s.created_at,
    })),
    activity,
  }
}
