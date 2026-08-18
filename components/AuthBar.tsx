import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { getProfile } from '@/lib/profiles'
import AccountMenu from './AccountMenu'

export default async function AuthBar() {
  const user = await getSessionUser()

  if (!user) {
    return (
      <Link
        href="/auth/signin"
        className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-all hover:-translate-y-0.5 hover:border-red hover:bg-red hover:text-white"
      >
        <i className="fa-solid fa-user" aria-hidden="true" />
        Se connecter
      </Link>
    )
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
