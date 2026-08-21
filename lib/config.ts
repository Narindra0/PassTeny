/**
 * Pass'Teny — Configuration centralisée (variables d'environnement).
 *
 * Aucune valeur sensible n'est commitée : tout passe par .env / .env.local
 * (voir `.env.example`).
 */

export const config = {
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://teny.passiio.shop'
      : 'http://localhost:3000'),

  /**
   * Source du contenu.
   * - Par défaut : repo GitHub public via `raw.githubusercontent.com` + API GitHub.
   * - Si CONTENT_LOCAL=true : dossier local `content/` (miroir du repo content).
   */
  contentRepo: process.env.CONTENT_REPO || 'Narindra0/pass-teny-content',
  contentBranch: process.env.CONTENT_BRANCH || 'main',
  useLocalContent: process.env.CONTENT_LOCAL === 'true',

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    /** Clé service-role : réservée au serveur (jamais exposée au client). */
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  /** Token GitHub (fine-grained) utilisé côté serveur pour ouvrir/merger les PR. */
  githubToken: process.env.GITHUB_TOKEN || '',

  /**
   * Emails des modérateurs de lancement (séparés par des virgules).
   * Promus au rôle `moderator` à la connexion (voir lib/profiles.ts).
   */
  moderatorEmails: (process.env.MODERATOR_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
} as const

export function isSupabaseConfigured() {
  return Boolean(config.supabase.url && config.supabase.anonKey)
}
