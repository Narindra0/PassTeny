'use client'

/**
 * Éditeur d'articles pour le magazine Pass'Teny.
 *
 * Permet d'écrire un article avec :
 * - Titre + sous-titre
 * - Catégorie + tags
 * - Contenu en Markdown avec upload de photos
 * - Prévisualisation en temps réel
 */
import { useCallback, useRef, useState } from 'react'
import { openSignIn } from '@/components/SignInModal'
import { CATEGORY_LABELS, type ArticleCategory } from '@/lib/articles'

interface ArticleEditorProps {
  isLoggedIn: boolean
  onSubmitted?: (id: string) => void
}

const CATEGORIES: ArticleCategory[] = ['journal', 'analyse', 'portrait', 'réflexion', 'guide']

export default function ArticleEditor({ isLoggedIn, onSubmitted }: ArticleEditorProps) {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<ArticleCategory>('journal')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Upload d'image ──
  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/articles/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'upload')
        return
      }
      // Insérer le Markdown image au curseur
      const textarea = textareaRef.current
      const imageMarkdown = `\n![${file.name}](${data.url})\n`
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newContent = content.slice(0, start) + imageMarkdown + content.slice(end)
        setContent(newContent)
        // Repositionner le curseur après l'image
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + imageMarkdown.length
          textarea.focus()
        }, 0)
      } else {
        setContent((c) => c + imageMarkdown)
      }
    } catch {
      setError('Erreur lors de l\'upload de l\'image')
    } finally {
      setUploading(false)
    }
  }, [content])

  // ── Drag & drop ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file)
    }
  }, [handleImageUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // ── Tags ──
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags((t) => [...t, tag])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setTags((t) => t.filter((t2) => t2 !== tag))
  }

  // ── Soumission ──
  const handleSubmit = async () => {
    if (!isLoggedIn) {
      openSignIn()
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subtitle, content, coverUrl, category, tags }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la soumission')
        return
      }
      setSuccess(true)
      onSubmitted?.(data.id)
    } catch {
      setError('Erreur lors de la soumission')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Estimation du temps de lecture ──
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.round(wordCount / 200))

  // ── État succès ──
  if (success) {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green/10">
          <i className="fa-solid fa-circle-check text-3xl text-green" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-grotesk text-xl font-bold text-ink">Article publié !</h2>
        <p className="mt-2 max-w-md text-sm text-ink-soft">
          Votre article est maintenant visible sur le magazine. Merci pour votre contribution !
        </p>
        <button
          type="button"
          onClick={() => {
            setSuccess(false)
            setTitle('')
            setSubtitle('')
            setContent('')
            setCoverUrl('')
            setCategory('journal')
            setTags([])
          }}
          className="btn btn-primary btn-sm btn-sharp mt-5"
        >
          <i className="fa-solid fa-pen" aria-hidden="true" /> Écrire un autre article
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── En-tête : titre + sous-titre ── */}
      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de votre article"
          maxLength={200}
          className="w-full rounded-xl border border-line-strong bg-card px-4 py-3 font-grotesk text-lg font-bold text-ink placeholder:text-ink-faint focus:border-red focus:outline-none"
        />
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Sous-titre (optionnel)"
          className="w-full rounded-xl border border-line-strong bg-card px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-red focus:outline-none"
        />
      </div>

      {/* ── Catégorie + Tags ── */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            Catégorie
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_LABELS[cat]
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-all ${
                    category === cat
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line-strong text-ink-soft hover:border-ink hover:text-ink'
                  }`}
                >
                  <i className={meta.icon} aria-hidden="true" /> {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            Tags (max 5)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addTag() }
                if (e.key === ',' ) { e.preventDefault(); addTag() }
              }}
              placeholder="Ajouter un tag…"
              className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-red focus:outline-none"
            />
            <button type="button" onClick={addTag} className="btn btn-secondary btn-sm">
              +
            </button>
          </div>
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-paper-deep px-2 py-0.5 font-mono text-[9px] text-ink-faint">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-ink-faint hover:text-red">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Couverture ── */}
      <div>
        <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
          Image de couverture (URL)
        </label>
        <input
          type="url"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-xl border border-line-strong bg-card px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-red focus:outline-none"
        />
      </div>

      {/* ── Contenu + Upload ── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            Contenu (Markdown)
          </label>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-ink-faint">
              {wordCount} mots · ~{readTime} min
            </span>
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="font-mono text-[10px] font-medium text-red transition-colors hover:text-red-dark"
            >
              {showPreview ? 'Éditer' : 'Aperçu'}
            </button>
          </div>
        </div>

        {/* Barre d'outils */}
        <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-line-strong bg-paper-alt px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink disabled:opacity-50"
          >
            {uploading ? (
              <i className="fa-solid fa-spinner animate-spin text-[10px]" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-image text-[10px]" aria-hidden="true" />
            )}
            {uploading ? 'Upload…' : 'Photo'}
          </button>
          <span className="text-line-strong">|</span>
          <button
            type="button"
            onClick={() => {
              const ta = textareaRef.current
              if (!ta) return
              const s = ta.selectionStart
              const e = ta.selectionEnd
              const selected = content.slice(s, e)
              const insert = `**${selected || 'texte en gras'}**`
              setContent((c) => c.slice(0, s) + insert + c.slice(e))
            }}
            className="rounded-md px-2 py-1 font-mono text-[10px] font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            G
          </button>
          <button
            type="button"
            onClick={() => {
              const ta = textareaRef.current
              if (!ta) return
              const s = ta.selectionStart
              const e = ta.selectionEnd
              const selected = content.slice(s, e)
              const insert = `*${selected || 'texte en italique'}*`
              setContent((c) => c.slice(0, s) + insert + c.slice(e))
            }}
            className="rounded-md px-2 py-1 font-mono text-[10px] italic text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => {
              const ta = textareaRef.current
              if (!ta) return
              const s = ta.selectionStart
              setContent((c) => c.slice(0, s) + '\n## ' + c.slice(s))
            }}
            className="rounded-md px-2 py-1 font-mono text-[10px] font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => {
              const ta = textareaRef.current
              if (!ta) return
              const s = ta.selectionStart
              setContent((c) => c.slice(0, s) + '\n- ' + c.slice(s))
            }}
            className="rounded-md px-2 py-1 font-mono text-[10px] text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <i className="fa-solid fa-list-ul text-[9px]" aria-hidden="true" />
          </button>
        </div>

        {/* Zone de texte / Aperçu */}
        {showPreview ? (
          <div
            className="min-h-[300px] rounded-b-xl border border-line-strong bg-card p-5 prose-passeny"
            dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            placeholder="Écrivez votre article ici…&#10;&#10;Vous pouvez utiliser le Markdown :&#10;## Titre&#10;**gras** *italique*&#10;- liste&#10;&#10;Glissez une image pour l'insérer."
            rows={15}
            className="w-full resize-y rounded-b-xl border border-line-strong bg-card px-4 py-3 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:border-red focus:outline-none"
          />
        )}
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div className="rounded-xl border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
          <i className="fa-solid fa-circle-exclamation mr-1.5" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── Bouton publier ── */}
      <div className="flex items-center justify-between border-t border-line pt-5">
        <p className="max-w-xs text-[11px] leading-relaxed text-ink-faint">
          Votre article sera visible immédiatement. Vous pourrez le modifier ou le supprimer depuis votre profil.
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim() || content.trim().length < 20 || submitting}
          className="btn btn-primary btn-sharp disabled:opacity-40"
        >
          {submitting ? (
            <><i className="fa-solid fa-spinner animate-spin" aria-hidden="true" /> Publication…</>
          ) : (
            <><i className="fa-solid fa-paper-plane" aria-hidden="true" /> Publier l&apos;article</>
          )}
        </button>
      </div>
    </div>
  )
}

/** Rendu basique du Markdown pour l'aperçu. */
function renderPreview(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="mt-6 mb-2 font-grotesk text-lg font-bold text-ink">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="mt-4 mb-2 font-grotesk text-base font-bold text-ink">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="my-4 max-w-full rounded-xl border border-line-strong" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-red underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-ink-soft list-disc">$1</li>')
    .split('\n\n')
    .map((block) => {
      const t = block.trim()
      if (!t) return ''
      if (t.startsWith('<h') || t.startsWith('<img') || t.startsWith('<li')) return t
      if (t.startsWith('<li')) return `<ul class="my-2 space-y-1">${t}</ul>`
      return `<p class="text-sm leading-relaxed text-ink-soft">${t}</p>`
    })
    .join('\n')
}
