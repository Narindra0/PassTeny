import { listTags } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tags = await listTags()
  return Response.json({ tags })
}
