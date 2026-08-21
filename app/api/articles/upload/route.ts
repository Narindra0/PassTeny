import { requireUser } from '@/lib/auth'
import { uploadArticleImage } from '@/lib/articles'
import { routeError } from '@/lib/routeError'

export const dynamic = 'force-dynamic'

/** POST /api/articles/upload — Upload une image pour un article (connecté). */
export async function POST(request: Request) {
  try {
    return await handlePost(request)
  } catch (err) {
    return routeError(err)
  }
}

async function handlePost(request: Request) {
  const user = await requireUser()

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  }

  const result = await uploadArticleImage(user, file)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }

  return Response.json({ ok: true, url: result.url })
}
