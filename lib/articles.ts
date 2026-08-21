/**
 * Articles communautaires — le magazine ouvert à la communauté.
 *
 * Les utilisateurs connectés peuvent écrire des articles avec photos.
 * Les articles passent par un statut pending → approved (modération).
 */
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type { SessionUser } from '@/lib/auth'
import type { ArticleCategory, CommunityArticle } from '@/lib/articleShared'
import { estimateReadTime } from '@/lib/articleShared'

// Re-export pour compatibilité avec les imports existants
export type { ArticleCategory, CommunityArticle } from '@/lib/articleShared'
export { CATEGORY_LABELS, estimateReadTime } from '@/lib/articleShared'

// ── Lecture ───────────────────────────────────────────────────────────────

/** Liste les articles approuvés (public). */
export async function listApprovedArticles(limit = 20): Promise<CommunityArticle[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []

  const { data: articles } = await supabase
    .from('community_articles')
    .select('id, author_id, title, subtitle, content, cover_url, category, tags, status, read_time, created_at, updated_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!articles || articles.length === 0) return []

  // Récupérer les pseudos des auteurs
  const authorIds = [...new Set(articles.map((a) => a.author_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', authorIds)
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p.username]))

  return articles.map((a) => ({
    id: a.id,
    authorId: a.author_id,
    authorUsername: profileById.get(a.author_id),
    title: a.title,
    subtitle: a.subtitle ?? undefined,
    content: a.content,
    coverUrl: a.cover_url ?? undefined,
    category: (a.category as ArticleCategory) || 'journal',
    tags: a.tags ?? [],
    status: a.status as CommunityArticle['status'],
    readTime: a.read_time ?? undefined,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }))
}

/** Liste les articles de l'utilisateur courant (tous statuts). */
export async function listMyArticles(userId: string): Promise<CommunityArticle[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []

  const { data: articles } = await supabase
    .from('community_articles')
    .select('id, author_id, title, subtitle, content, cover_url, category, tags, status, read_time, created_at, updated_at')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })

  if (!articles) return []

  return articles.map((a) => ({
    id: a.id,
    authorId: a.author_id,
    title: a.title,
    subtitle: a.subtitle ?? undefined,
    content: a.content,
    coverUrl: a.cover_url ?? undefined,
    category: (a.category as ArticleCategory) || 'journal',
    tags: a.tags ?? [],
    status: a.status as CommunityArticle['status'],
    readTime: a.read_time ?? undefined,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }))
}

/** Récupère un article par son ID. */
export async function getArticle(id: string): Promise<CommunityArticle | null> {
  const supabase = getSupabaseServer()
  if (!supabase) return null

  const { data: article } = await supabase
    .from('community_articles')
    .select('id, author_id, title, subtitle, content, cover_url, category, tags, status, read_time, created_at, updated_at')
    .eq('id', id)
    .single()

  if (!article) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', article.author_id)
    .single()

  return {
    id: article.id,
    authorId: article.author_id,
    authorUsername: profile?.username,
    title: article.title,
    subtitle: article.subtitle ?? undefined,
    content: article.content,
    coverUrl: article.cover_url ?? undefined,
    category: (article.category as ArticleCategory) || 'journal',
    tags: article.tags ?? [],
    status: article.status as CommunityArticle['status'],
    readTime: article.read_time ?? undefined,
    createdAt: article.created_at,
    updatedAt: article.updated_at,
  }
}

// ── Écriture ──────────────────────────────────────────────────────────────

/** Soumet un nouvel article. */
export async function submitArticle(
  user: SessionUser,
  data: {
    title: string
    subtitle?: string
    content: string
    coverUrl?: string
    category: ArticleCategory
    tags?: string[]
  },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré' }

  const readTime = estimateReadTime(data.content)

  const { data: article, error } = await admin
    .from('community_articles')
    .insert({
      author_id: user.id,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      content: data.content.trim(),
      cover_url: data.coverUrl || null,
      category: data.category,
      tags: data.tags ?? [],
      status: 'approved', // auto-approve pour commencer
      read_time: readTime,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: article.id }
}

/** Met à jour un article existant (auteur uniquement). */
export async function updateArticle(
  user: SessionUser,
  articleId: string,
  data: {
    title?: string
    subtitle?: string
    content?: string
    coverUrl?: string
    category?: ArticleCategory
    tags?: string[]
  },
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré' }

  const updates: Database['public']['Tables']['community_articles']['Update'] = { updated_at: new Date().toISOString() }
  if (data.title !== undefined) updates.title = data.title.trim()
  if (data.subtitle !== undefined) updates.subtitle = data.subtitle?.trim() || null
  if (data.content !== undefined) {
    updates.content = data.content.trim()
    updates.read_time = estimateReadTime(data.content)
  }
  if (data.coverUrl !== undefined) updates.cover_url = data.coverUrl || null
  if (data.category !== undefined) updates.category = data.category
  if (data.tags !== undefined) updates.tags = data.tags

  const { error } = await admin
    .from('community_articles')
    .update(updates)
    .eq('id', articleId)
    .eq('author_id', user.id) // sécurité : seul l'auteur

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Supprime un article. */
export async function deleteArticle(
  user: SessionUser,
  articleId: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré' }

  const { error } = await admin
    .from('community_articles')
    .delete()
    .eq('id', articleId)
    .or(`author_id.eq.${user.id},exists(select 1 from public.profiles where id = '${user.id}' and role = 'moderator')`)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Upload d'image ────────────────────────────────────────────────────────

/**
 * Upload une image vers Supabase Storage et retourne l'URL publique.
 * Bucket attendu : 'article-images' (à créer dans Supabase Dashboard).
 */
export async function uploadArticleImage(
  user: SessionUser,
  file: File,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'Supabase non configuré' }

  // Valider le type
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    return { ok: false, error: 'Format non supporté (JPEG, PNG, WebP, GIF uniquement)' }
  }

  // Valider la taille (5 Mo max)
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'Fichier trop volumineux (5 Mo maximum)' }
  }

  // Générer un chemin unique
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `articles/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  // Convertir File en ArrayBuffer puis Uint8Array
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  const { error } = await admin.storage
    .from('article-images')
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return { ok: false, error: error.message }

  // Récupérer l'URL publique
  const { data: urlData } = admin.storage
    .from('article-images')
    .getPublicUrl(path)

  return { ok: true, url: urlData.publicUrl }
}
