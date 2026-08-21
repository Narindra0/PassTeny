import { getSessionUser } from '@/lib/auth'
import { getProfile } from '@/lib/profiles'
import AccountMenu from './AccountMenu'
import SignInButton from './SignInButton'

export default async function AuthBar() {
  const user = await getSessionUser()

  if (!user) {
    return <SignInButton />
  }

  const profile = await getProfile(user.id)
  if (!profile) {
    // Profil absent (pré-migration) : on garde un repli sobre.
    return (
      <span
        className="hidden max-w-[160px] truncate font-mono text-[11px] uppercase tracking-wider text-ink-faint sm:block"
        title={user.email}
      >
        <i className="fa-solid fa-circle-check mr-1 text-mustard-dark" aria-hidden="true" />
        {user.email}
      </span>
    )
  }

  return <AccountMenu username={profile.username} email={user.email} role={profile.role} />
}
