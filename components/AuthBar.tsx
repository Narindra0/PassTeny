import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { signOutAction } from '@/lib/actions/auth'

export default async function AuthBar() {
  const user = await getSessionUser()

  if (!user) {
    return (
      <Link
        href="/auth/signin"
        className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:border-amber-500 hover:text-amber-600 dark:border-zinc-700 dark:hover:text-amber-400"
      >
        Se connecter
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[160px] truncate text-sm text-zinc-500 sm:block" title={user.email}>
        {user.email}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:border-red-400 hover:text-red-500 dark:border-zinc-700"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  )
}
