import type { Metadata } from 'next'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ArticleEditor from '@/components/ArticleEditor'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Écrire un article — Magazine',
  description: 'Partagez votre analyse, portrait ou réflexion sur la scène musicale malgache.',
}

export default async function NewArticlePage() {
  const user = await getSessionUser()

  // Rediriger vers la connexion si non connecté
  if (!user) {
    redirect('/')
  }

  return (
    <div className="flex-1">
      {/* ══ Hero ══ */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <nav className="mb-4 font-mono text-[0.65rem] uppercase tracking-wider text-paper/50">
            <Link href="/" className="transition-colors hover:text-white">Accueil</Link>
            <span className="mx-2 text-paper/30">/</span>
            <Link href="/magazine" className="transition-colors hover:text-white">Magazine</Link>
            <span className="mx-2 text-paper/30">/</span>
            <span className="text-paper/70">Nouvel article</span>
          </nav>

          <h1 className="font-grotesk text-2xl font-bold uppercase tracking-tight text-paper sm:text-3xl">
            Écrire un article
          </h1>
          <p className="mt-2 max-w-lg text-sm text-paper/60">
            Partagez votre analyse, portrait, réflexion ou guide sur la scène musicale malgache.
            Vous pouvez insérer des photos et formater en Markdown.
          </p>
        </div>
      </section>

      {/* ══ Éditeur ══ */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ArticleEditor isLoggedIn={true} />
      </div>
    </div>
  )
}
