/** Convertit une erreur levée dans une API route en Response JSON. */
export function routeError(err: unknown): Response {
  const status = (err as { status?: number })?.status ?? 500
  const message = err instanceof Error ? err.message : 'Erreur interne'
  return Response.json({ error: message }, { status })
}
