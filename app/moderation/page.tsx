import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getProfile } from '@/lib/profiles'
import { listAnnotationQueue, listSuggestionQueue } from '@/lib/moderation'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { config } from '@/lib/config'
import ModerationPanel from '@/components/ModerationPanel'

export const dynamic = 'force-dynamic'

/**
 * « Modération » — réservée aux modérateurs :
 *  1. la file des soumissions d'annotations (approbation → PR sur le repo
 *     content, merge via le webhook GitHub → canon) ;
 *  2. la file des suggestions de lyrics.
 */
export default async function ModerationPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/signin')

  const profile = await getProfile(user.id)
  if (!profile || profile.role !== 'moderator') redirect('/')

  const [annotations, suggestions] = await Promise.all([listAnnotationQueue(50), listSuggestionQueue(50)])

  // Pseudo des auteurs de suggestions de lyrics (id de profils = id d'auth).
  const admin = getSupabaseAdmin()
  let usernameById = new Map<string, string>()
  if (admin && suggestions.length > 0) {
    const authorIds = [...new Set(suggestions.map((s) => s.author_id))]
    const { data } = await admin.from('profiles').select('id, username').in('id', authorIds)
    usernameById = new Map((data ?? []).map((p) => [p.id, p.username]))
  }

  const rows = suggestions.map((s) => ({ ...s, author: usernameById.get(s.author_id) ?? 'inconnu' }))
  return <ModerationPanel annotations={annotations} suggestions={rows} repoPath={config.contentRepo} />
}
