import { listAnnotationsByTag } from '@/lib/tags'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ tag: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const { tag } = await params
  const annotations = await listAnnotationsByTag(tag)
  return Response.json({ tag, annotations })
}
