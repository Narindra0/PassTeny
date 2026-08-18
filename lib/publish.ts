/**
 * Publication des suggestions de lyrics — « tout automatique ».
 *
 * Deux modes (réglage `settings.moderation.launch_mode`) :
 *   - `auto` (défaut) : la soumission publie directement sur le repo content
 *     (commit sur la branche principale, pas de PR) — seule la limite
 *     journalière (quota) freine.
 *   - `manual` : la soumission reste `pending` ; l'approbation d'un
 *     modérateur déclenche la publication.
 *
 * Les publications sont **sérialisées** (file d'attente processus) : chaque
 * commit relit `index.json` fraîchement, donc jamais de conflit, même si
 * Sofie et Mark publient au même moment.
 */
import { commitNewSongToMain, type NewSongChange } from '@/lib/github'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { syncLocalContent } from '@/lib/contentSync'

/** File d'attente processus : une publication à la fois (base toujours à jour). */
let publishQueue: Promise<unknown> = Promise.resolve()

export interface PublishInput {
  id: string
  artistSlug: string
  songSlug: string
  artistName: string
  title: string
  album: string | null
  coverUrl: string | null
  passioAlbumId: string | null
  passioTrackId: string | null
  lyrics: string
  lyricsFormat: 'lrc' | 'txt'
}

export interface PublishResult {
  ok: boolean
  published: boolean
  commitUrl: string | null
  error?: string
}

/** Mode de lancement : `auto` (défaut) ou `manual` (file de modération). */
export async function getLaunchMode(): Promise<'auto' | 'manual'> {
  const admin = getSupabaseAdmin()
  if (!admin) return 'auto'
  const { data } = await admin.from('settings').select('value').eq('key', 'moderation').maybeSingle()
  const value = data?.value as { launch_mode?: string } | null | undefined
  return value?.launch_mode === 'manual' ? 'manual' : 'auto'
}

async function markMerged(id: string, commitUrl: string): Promise<void> {
  const admin = getSupabaseAdmin()
  if (!admin) return
  await admin
    .from('lyric_suggestions')
    .update({ status: 'merged', pr_number: null })
    .eq('id', id)
  // Le lien du commit n'a pas de colonne dédiée : on le garde en log.
  console.log(`[publish] suggestion ${id} publiée → ${commitUrl}`)
}

/**
 * Publie une suggestion : commit direct sur la branche principale puis
 * marque `merged`. Sérialisé par la file d'attente.
 */
export function publishLyricSuggestion(input: PublishInput): Promise<PublishResult> {
  const change: NewSongChange = {
    artistSlug: input.artistSlug,
    songSlug: input.songSlug,
    artistName: input.artistName,
    title: input.title,
    album: input.album,
    coverUrl: input.coverUrl,
    passioAlbumId: input.passioAlbumId,
    passioTrackId: input.passioTrackId,
    lyrics: input.lyrics,
    lyricsFormat: input.lyricsFormat,
    commitMessage: `Nouveau titre : ${input.title} (${input.artistName})`,
  }

  return new Promise<PublishResult>((resolve) => {
    publishQueue = publishQueue.then(async () => {
      try {
        const { commitUrl } = await commitNewSongToMain(change)
        await markMerged(input.id, commitUrl)
        await syncLocalContent()
        resolve({ ok: true, published: true, commitUrl })
      } catch (err) {
        console.error('[publish] échec:', err)
        resolve({ ok: false, published: false, commitUrl: null, error: 'Publication impossible' })
      }
    })
  })
}
