import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getProfile } from '@/lib/profiles'
import OnboardingForm from '@/components/OnboardingForm'

export const dynamic = 'force-dynamic'

/**
 * Onboarding du premier login : on demande le pseudo (choix confirmé) et,
 * optionnellement, les liens Facebook / Instagram. Tant que le profil n'est
 * pas onboardé, le callback d'auth redirige ici.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect('/auth/signin')

  const profile = await getProfile(user.id)
  if (!profile) redirect('/')

  if (profile.onboarding_done) {
    redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
  }

  return <OnboardingForm initialUsername={profile.username} next={next} />
}
