import { requireUser } from '@/lib/auth'
import { listApprovedArticles, submitArticle, type ArticleCategory } from '@/lib/articles'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

/** GET /api/articles — Liste les articles approuvés (public). */
export async function GET() {
  try {
    const articles = await listApprovedArticles(20)
    return Response.json(articles)
  } catch (err) {
    return routeError(err)
  }
}

/** POST /api/articles — Soumet un nouvel article (connecté). */
export async function POST(request: Request) {
  try {
    return await handlePost(request)
  } catch (err) {
    return routeError(err)
  }
}

async function handlePost(request: Request) {
  const user = await requireUser()
  const body = await request.json().catch(() => ({}))
  const { title, subtitle, content, coverUrl, category, tags } = body ?? {}

  if (typeof title !== 'string' || title.trim().length < 5) {
    return Response.json({ error: 'Titre trop court (5 caractères minimum)' }, { status: 400 })
  }
  if (title.length > 200) {
    return Response.json({ error: 'Titre trop long (200 caractères maximum)' }, { status: 400 })
  }
  if (typeof content !== 'string' || content.trim().length < 20) {
    return Response.json({ error: 'Contenu trop court (20 caractères minimum)' }, { status: 400 })
  }

  const validCategories: ArticleCategory[] = ['journal', 'analyse', 'portrait', 'réflexion', 'guide']
  const cat = validCategories.includes(category) ? category : 'journal'

  const result = await submitArticle(user, {
    title,
    subtitle: typeof subtitle === 'string' ? subtitle : undefined,
    content,
    coverUrl: typeof coverUrl === 'string' ? coverUrl : undefined,
    category: cat,
    tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string').slice(0, 5) : [],
  })

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 })
  }

  return Response.json({ ok: true, id: result.id }, { status: 201 })
}
