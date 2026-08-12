/**
 * Glossaire des expressions locales (ohabolana, slang…).
 * Les termes sont approuvés par la communauté avant publication.
 */
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server'
import type { SessionUser } from '@/lib/auth'

export interface GlossaryTerm {
  id: string
  term: string
  meaning: string
  language: string
  example: string | null
  approved: boolean
  created_at: string
}

/** Termes approuvés, classés par terme. */
export async function listApprovedTerms(): Promise<GlossaryTerm[]> {
  const supabase = getSupabaseServer()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('glossary_terms')
    .select('id, term, meaning, language, example, approved, created_at')
    .eq('approved', true)
    .order('term')
  if (error) {
    console.error('[glossary] list:', error.message)
    return []
  }
  return (data ?? []) as GlossaryTerm[]
}

/** Propose un nouveau terme (en attente d'approbation). */
export async function proposeTerm(user: SessionUser, term: string, meaning: string, language = 'mg', example?: string) {
  const admin = getSupabaseAdmin()
  if (!admin) return { error: 'Supabase non configuré' }

  const { data, error } = await admin
    .from('glossary_terms')
    .insert({
      term: term.trim(),
      meaning: meaning.trim(),
      language,
      example: example?.trim() || null,
      author_id: user.id,
      approved: false,
    })
    .select('id, term, meaning, language, example, approved')
    .single()

  if (error) return { error: error.message }
  return { data }
}
