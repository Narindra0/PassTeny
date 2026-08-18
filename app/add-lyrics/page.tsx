import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getProfile } from '@/lib/profiles'
import { getDailyQuota, getRecentSuggestions, getUsedToday } from '@/lib/lyrics'
import { warmPassioTrackIndex } from '@/lib/passio'
import AddLyricsForm from '@/components/AddLyricsForm'

export const dynamic = 'force-dynamic'

/**
 * « Ajouter une parole » — proposer un nouveau titre au catalogue.
 * Réservé aux utilisateurs connectés, limité à un quota par jour.
 * Le titre est recherché dans le catalogue Pass'io puis soumis en LRC ou TXT.
 */
export default async function AddLyricsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/signin')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/')

  const [daily, usedToday, recent] = await Promise.all([
    getDailyQuota(),
    getUsedToday(user.id),
    getRecentSuggestions(user.id, 6),
  ])

  // Pré-chauffe l'index des pistes Pass'io en arrière-plan : pendant que
  // l'utilisateur lit la page et tape, la recherche sera déjà instantanée.
  warmPassioTrackIndex()

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <span className="sticker red">
        <i className="fa-solid fa-file-pen mr-1.5" aria-hidden="true" />
        Contribution
      </span>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Ajouter une parole
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
        Recherchez le titre dans le catalogue Pass&apos;io, puis ajoutez ses paroles en texte brut
        (choix par défaut) ou en LRC — collez le texte ou importez directement un fichier
        .txt / .lrc. Votre proposition sera relue avant publication.
      </p>

      <AddLyricsForm
        username={profile.username}
        dailyQuota={daily}
        usedToday={usedToday}
        recent={recent}
      />
    </div>
  )
}
