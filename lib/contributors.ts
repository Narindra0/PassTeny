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
  createdAt: string
}

export interface ContributorPageData {
  profile: Profile & { created_at: string }
  stats: {
    merged: number
    votesReceived: number
    votesCast: number
    accountAgeDays: number
    lyricSuggestionsMerged: number
  }
  annotations: PublishedAnnotation[]
  suggestions: PublishedSuggestion[]
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

  // Suggestions de lyrics publiées.
  const { data: suggestions } = await admin
    .from('lyric_suggestions')
    .select('id, song_slug, track_title, artist_name, created_at')
    .eq('author_id', profile.id)
    .eq('status', 'merged')
    .order('created_at', { ascending: false })
    .limit(20)

  return {
    profile: profile as Profile & { created_at: string },
    stats: {
      merged: stats.merged,
      votesReceived: stats.votesReceived,
      votesCast: stats.votesCast,
      accountAgeDays: stats.accountAgeDays,
      lyricSuggestionsMerged: suggestions?.length ?? 0,
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
      createdAt: s.created_at,
    })),
  }
}
