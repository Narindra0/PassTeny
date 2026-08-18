'use client'

/**
 * « Ajouter une parole » — recherche **directe de pistes** dans le catalogue
 * Pass'io (index serveur, instantanée après le premier chargement), choix
 * du format (LRC / TXT) et envoi. L'album n'est plus une étape : c'est une
 * information affichée sur chaque résultat. Quota journalier en direct.
 */
import { useRef, useState } from 'react'
import CoverImage from './CoverImage'

/**
 * Transforme des paroles brutes selon le format choisi :
 * TXT = version texte brut, sans les horodatages LRC.
 */
function applyFormat(raw: string, format: 'lrc' | 'txt'): string {
  if (format === 'lrc') return raw
  return raw
    .replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
}

interface TrackHit {
  id: string
  title: string
  artistName: string
  albumTitle: string
  albumId: string
  coverUrl: string | null
  hasLyrics: boolean
}

interface AlbumHit {
  id: string
  title: string
  artistName: string | null
  coverUrl: string | null
  type: string | null
  publicationDate: string | null
}

interface AlbumTrack {
  id: string
  title: string
  position: number
  hasLyrics: boolean
}

interface RecentSuggestion {
  id: string
  artist_name: string
  track_title: string
  album_title: string | null
  lyrics_format: 'lrc' | 'txt'
  status: string
  pr_number: number | null
  created_at: string
}

interface AddLyricsFormProps {
  username: string
  dailyQuota: number
  usedToday: number
  recent: RecentSuggestion[]
}

type SearchMode = 'tracks' | 'albums'
type Step = 'search' | 'album' | 'track' | 'done'

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente de revue',
  merged: 'Publié',
  rejected: 'Refusé',
}

export default function AddLyricsForm({ username, dailyQuota, usedToday, recent }: AddLyricsFormProps) {
  const [step, setStep] = useState<Step>('search')
  const [mode, setMode] = useState<SearchMode>('tracks')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [tracks, setTracks] = useState<TrackHit[]>([])
  const [albums, setAlbums] = useState<AlbumHit[]>([])
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Parcours album (mode secondaire) : album choisi → ses pistes.
  const [album, setAlbum] = useState<AlbumHit | null>(null)
  const [albumTracks, setAlbumTracks] = useState<AlbumTrack[]>([])
  const [loadingAlbumTracks, setLoadingAlbumTracks] = useState(false)

  // Piste retenue (recherche directe ou piste d'album) → formulaire.
  const [selected, setSelected] = useState<TrackHit | null>(null)
  const [format, setFormat] = useState<'lrc' | 'txt'>('txt')
  const [lyrics, setLyrics] = useState('')
  const [prefillLoading, setPrefillLoading] = useState(false)

  // Pré-remplissage / import : garde la version brute (LRC) pour pouvoir
  // retransformer le contenu si l'utilisateur change de format.
  const [prefillRaw, setPrefillRaw] = useState('')
  const [prefilled, setPrefilled] = useState(false)

  // Import direct de fichier .lrc / .txt.
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Format détecté dans le fichier importé, s'il diffère du mode actif.
  const [importHint, setImportHint] = useState<{ detected: 'lrc' | 'txt' } | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ commitUrl: string | null; published: boolean; quotaLeft: number } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function runSearch(raw: string, m: SearchMode) {
    const q = raw.trim()
    abortRef.current?.abort()
    if (!q) {
      setTracks([])
      setAlbums([])
      setSearched(false)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setSearching(true)
    // Garde-fou : si le catalogue Pass'io est long à répondre (premier
    // build de l'index), on abandonne après 30 s au lieu de spinner à l'infini.
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 30_000)
    fetch(`/api/passio/search?q=${encodeURIComponent(q)}&type=${m}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setSearchError('')
        setTracks(data.tracks ?? [])
        setAlbums(data.albums ?? [])
        setSearched(true)
      })
      .catch(() => {
        // Annulée par la frappe suivante → silencieux (la nouvelle recherche gère l'affichage).
        if (controller.signal.aborted && !timedOut) return
        setSearchError(
          "Impossible de contacter le catalogue — réessayez dans un instant. (Si l'erreur " +
            'persiste, désactivez vos extensions de navigateur puis rechargez.)',
        )
        setTracks([])
        setAlbums([])
        setSearched(true)
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (!controller.signal.aborted) setSearching(false)
      })
  }

  function onQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value, mode), 200)
  }

  function switchMode(m: SearchMode) {
    setMode(m)
    setTracks([])
    setAlbums([])
    setSearched(false)
    runSearch(query, m)
  }

  /** Recherche directe : le résultat est la piste → formulaire immédiat.
   * Le format par défaut est TXT (texte brut, le plus rapide) ; si le titre
   * a déjà des paroles sur Pass'io, elles sont pré-remplies sans horodatages. */
  function selectTrack(t: TrackHit) {
    setSelected(t)
    setStep('track')
    setError('')
    setFormat('txt')
    setLyrics('')
    setPrefillRaw('')
    setPrefilled(false)
    setFileInfo(null)
    if (t.hasLyrics) {
      setPrefillLoading(true)
      fetch(`/api/passio/lyrics/${t.id}`)
        .then((r) => (r.ok ? r.json() : { lyrics: '' }))
        .then((data) => {
          const raw = data.lyrics ?? ''
          setPrefillRaw(raw)
          setLyrics(applyFormat(raw, 'txt'))
          setPrefilled(true)
        })
        .catch(() => {})
        .finally(() => setPrefillLoading(false))
    }
  }

  /** Parcours album : ouvre l'album puis propose ses pistes. */
  async function openAlbum(a: AlbumHit) {
    setAlbum(a)
    setStep('album')
    setLoadingAlbumTracks(true)
    setAlbumTracks([])
    setError('')
    try {
      const res = await fetch(`/api/passio/albums/${a.id}`)
      const data = await res.json()
      setAlbumTracks(data.tracks ?? [])
      if (!data.tracks?.length) setError('Cet album ne contient aucune piste.')
    } catch {
      setError('Impossible de charger l’album.')
    } finally {
      setLoadingAlbumTracks(false)
    }
  }

  /** Piste choisie depuis la tracklist d'un album → même formulaire. */
  function selectAlbumTrack(t: AlbumTrack) {
    if (!album) return
    selectTrack({
      id: t.id,
      title: t.title,
      artistName: album.artistName ?? 'Artiste inconnu',
      albumTitle: album.title,
      albumId: album.id,
      coverUrl: album.coverUrl,
      hasLyrics: t.hasLyrics,
    })
  }

  /** Change de format en retransformant le contenu pré-rempli ou importé. */
  function onFormatChange(f: 'lrc' | 'txt') {
    setFormat(f)
    if (prefilled && prefillRaw) setLyrics(applyFormat(prefillRaw, f))
  }

  /**
   * Détecte le format d'un fichier importé : extension `.lrc` ou présence
   * d'horodatages `[mm:ss.xx]` dans le contenu → LRC, sinon TXT.
   */
  function detectLyricsFormat(fileName: string, content: string): 'lrc' | 'txt' {
    if (/\.lrc$/i.test(fileName)) return 'lrc'
    const sample = content.slice(0, 3000)
    return /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(sample) ? 'lrc' : 'txt'
  }

  /** Import direct d'un fichier .lrc / .txt dans la zone de texte. */
  function readLyricsFile(file: File | null | undefined) {
    if (!file) return
    if (!/\.(lrc|txt)$/i.test(file.name)) {
      setError('Format non supporté — choisissez un fichier .lrc ou .txt.')
      return
    }
    if (file.size > 256 * 1024) {
      setError('Fichier trop volumineux (maximum 256 Ko).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result ?? '')
      const detected = detectLyricsFormat(file.name, raw)
      setPrefillRaw(raw)
      setLyrics(applyFormat(raw, format))
      setPrefilled(true)
      setFileInfo({ name: file.name, size: file.size })
      setImportHint(detected !== format ? { detected } : null)
      setError('')
    }
    reader.readAsText(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selected.artistName,
          trackTitle: selected.title,
          albumTitle: selected.albumTitle,
          coverUrl: selected.coverUrl,
          passioAlbumId: selected.albumId,
          passioTrackId: selected.id,
          lyricsFormat: format,
          lyrics,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue.')
        return
      }
      setResult({
        commitUrl: data.commitUrl ?? null,
        published: data.published === true,
        quotaLeft: data.quotaLeft ?? 0,
      })
      setStep('done')
    } catch {
      setError('Impossible d’envoyer la proposition.')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setStep('search')
    setQuery('')
    setTracks([])
    setAlbums([])
    setSearched(false)
    setAlbum(null)
    setAlbumTracks([])
    setSelected(null)
    setLyrics('')
    setFormat('txt')
    setPrefillRaw('')
    setPrefilled(false)
    setFileInfo(null)
    setImportHint(null)
    setError('')
    setResult(null)
  }

  const quotaLeft = Math.max(0, dailyQuota - usedToday - (result ? 1 : 0))

  // ── Aperçu de la proposition (premières lignes, compteurs) ──
  const PREVIEW_MAX_LINES = 5
  const lyricLines = lyrics ? lyrics.split('\n') : []
  const previewLines = lyricLines.slice(0, PREVIEW_MAX_LINES).join('\n')
  const previewTruncated = lyricLines.length > PREVIEW_MAX_LINES
  const previewReady = lyrics.trim().length >= 20

  const showTracks = mode === 'tracks' && searched && tracks.length > 0
  const showAlbums = mode === 'albums' && searched && albums.length > 0
  const showEmpty = searched && !searching && !searchError && (mode === 'tracks' ? tracks.length === 0 : albums.length === 0)

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* ── Quota du jour ── */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Vos ajouts aujourd&apos;hui
          </p>
          <p className="font-mono text-sm font-bold tabular-nums text-ink">
            {usedToday} / {dailyQuota}
          </p>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-deep"
          role="progressbar"
          aria-valuenow={usedToday}
          aria-valuemin={0}
          aria-valuemax={dailyQuota}
          aria-label="Quota d'ajouts du jour"
        >
          <div
            className="progress-fill h-full rounded-full bg-gradient-to-r from-red to-mustard"
            style={{ width: `${Math.min(100, (usedToday / Math.max(1, dailyQuota)) * 100)}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
          {quotaLeft > 0
            ? `Il vous reste ${quotaLeft} ajout${quotaLeft > 1 ? 's' : ''} aujourd'hui`
            : 'Quota du jour atteint — revenez demain !'}
        </p>
      </div>

      {/* ── Parcours ── */}
      <div className="card p-6 sm:p-8">
        {step === 'search' && (
          <div>
            <span className="eyebrow">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Trouver le titre
            </span>
            <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-ink">
              Rechercher dans le catalogue Pass&apos;io
              <div className="relative">
                <i
                  className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-ink-faint"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Titre ou artiste, ex. « Ziona »…"
                  className="input py-3 pl-10"
                  autoFocus
                />
              </div>
            </label>

            {/* Bascule Titres / Albums */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-ink-soft">
                Rechercher :
              </span>
              {(
                [
                  ['tracks', 'Titres', 'fa-music'],
                  ['albums', 'Albums', 'fa-compact-disc'],
                ] as const
              ).map(([m, label, icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  aria-pressed={mode === m}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.15em] transition-colors ${
                    mode === m
                      ? 'border-red bg-red text-white'
                      : 'border-line-strong text-ink-soft hover:border-red hover:text-red'
                  }`}
                >
                  <i className={`fa-solid ${icon} text-[0.6rem]`} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {searching && (
              <p className="mt-4 text-sm text-ink-soft">
                <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />
                {mode === 'tracks'
                  ? 'Recherche dans le catalogue…'
                  : 'Recherche des albums…'}
              </p>
            )}

            {searchError && (
              <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-sm leading-relaxed text-red">
                <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true" />
                <span>{searchError}</span>
              </p>
            )}

            {/* Résultats — pistes (chemin principal, sans passer par l'album) */}
            {showTracks && (
              <ul className="mt-4 flex flex-col divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-line-strong bg-paper-alt">
                {tracks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTrack(t)}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
                    >
                      <CoverImage
                        src={t.coverUrl}
                        alt=""
                        size="thumb"
                        className="h-11 w-11 shrink-0 rounded-lg border border-line-strong object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                          {t.title}
                        </span>
                        <span className="block truncate text-xs text-ink-soft">
                          {t.artistName}
                          {t.albumTitle ? ` · ${t.albumTitle}` : ''}
                        </span>
                      </span>
                      {t.hasLyrics ? (
                        <span className="shrink-0 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-green">
                          <i className="fa-solid fa-check mr-1" aria-hidden="true" />
                          Lyrics dispo
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-ink-faint">
                          à ajouter
                        </span>
                      )}
                      <i
                        className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Résultats — albums (mode secondaire) */}
            {showAlbums && (
              <ul className="mt-4 flex flex-col gap-2">
                {albums.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => openAlbum(a)}
                      className="group flex w-full items-center gap-4 rounded-xl border border-line-strong bg-paper-alt p-3 text-left transition-all hover:border-mustard hover:shadow-soft"
                    >
                      <CoverImage
                        src={a.coverUrl}
                        alt=""
                        size="thumb"
                        className="h-12 w-12 shrink-0 rounded-lg border border-line-strong object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                          {a.title}
                        </span>
                        <span className="block truncate text-sm text-ink-soft">
                          {a.artistName ?? 'Artiste inconnu'}
                        </span>
                      </span>
                      {a.type && (
                        <span className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-ink-faint">
                          {a.type}
                        </span>
                      )}
                      <i
                        className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showEmpty && (
              <p className="mt-4 rounded-xl border border-line-strong bg-paper-alt px-4 py-3 text-sm text-ink-soft">
                {mode === 'tracks'
                  ? 'Aucun titre trouvé. Essayez un autre nom, ou basculez sur la recherche d’albums.'
                  : 'Aucun album trouvé. Essayez un autre nom.'}
              </p>
            )}
          </div>
        )}

        {/* Parcours album : les pistes de l'album choisi */}
        {step === 'album' && album && (
          <div>
            <span className="eyebrow">
              <i className="fa-solid fa-list" aria-hidden="true" /> Choisir la piste
            </span>
            <div className="mt-4 flex items-center gap-3">
              <CoverImage
                src={album.coverUrl}
                alt=""
                size="thumb"
                className="h-12 w-12 shrink-0 rounded-lg border border-line-strong object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold text-ink">{album.title}</p>
                <p className="truncate text-sm text-ink-soft">{album.artistName}</p>
              </div>
              <button type="button" onClick={() => setStep('search')} className="btn btn-secondary btn-sm">
                <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Retour
              </button>
            </div>

            {loadingAlbumTracks ? (
              <p className="mt-5 text-sm text-ink-soft">
                <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />
                Chargement des pistes…
              </p>
            ) : (
              <ul className="mt-5 flex flex-col divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-line-strong bg-paper-alt">
                {albumTracks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectAlbumTrack(t)}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
                    >
                      <span className="rank-num" aria-hidden="true">
                        {String(t.position).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-red">
                        {t.title}
                      </span>
                      {t.hasLyrics ? (
                        <span className="shrink-0 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-green">
                          <i className="fa-solid fa-check mr-1" aria-hidden="true" />
                          Lyrics dispo
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-ink-faint">
                          à ajouter
                        </span>
                      )}
                      <i
                        className="fa-solid fa-chevron-right shrink-0 text-xs text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-red"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Formulaire d'ajout des paroles */}
        {step === 'track' && selected && (
          <form onSubmit={submit}>
            <span className="eyebrow">
              <i className="fa-solid fa-file-pen" aria-hidden="true" /> Ajouter les paroles
            </span>

            <div className="mt-4 flex items-center gap-3">
              <CoverImage
                src={selected.coverUrl}
                alt=""
                size="thumb"
                className="h-12 w-12 shrink-0 rounded-lg border border-line-strong object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold text-ink">{selected.title}</p>
                <p className="truncate text-sm text-ink-soft">
                  {selected.artistName} {selected.albumTitle ? `· ${selected.albumTitle}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setStep('search')} className="btn btn-secondary btn-sm">
                <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Retour
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-ink-soft">
                Format :
              </span>
              {(['txt', 'lrc'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFormatChange(f)}
                  aria-pressed={format === f}
                  className={`rounded-full border px-4 py-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.15em] transition-colors ${
                    format === f
                      ? 'border-red bg-red text-white'
                      : 'border-line-strong text-ink-soft hover:border-red hover:text-red'
                  }`}
                >
                  {f === 'txt' ? 'TXT (texte brut)' : 'LRC (horodatages)'}
                </button>
              ))}
            </div>

            {/* Import direct de fichier (.lrc / .txt) — glisser-déposer ou parcourir */}
            <div
              className={`mt-4 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragging ? 'border-red bg-red/5' : 'border-line-strong bg-paper-alt hover:border-red/60'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                readLyricsFile(e.dataTransfer.files?.[0])
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".lrc,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  readLyricsFile(e.target.files?.[0])
                  e.target.value = '' // permet de ré-importer le même fichier
                }}
              />
              <i
                className={`fa-solid ${format === 'lrc' ? 'fa-file-import' : 'fa-file-lines'} text-xl text-red`}
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-ink">
                {format === 'lrc' ? (
                  <>
                    Importer un fichier <span className="font-mono font-bold text-red">.lrc</span>{' '}
                    (horodatages inclus)
                  </>
                ) : (
                  <>
                    Importer un fichier <span className="font-mono font-bold text-red">.txt</span>
                  </>
                )}
              </p>
              <p className="text-xs text-ink-faint">
                Glissez-déposez ici, ou{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-semibold text-red underline underline-offset-2 transition-colors hover:text-red-dark"
                >
                  parcourez vos fichiers
                </button>
              </p>
              {fileInfo && (
                <p className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-green/10 px-3 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-green">
                  <i className="fa-solid fa-circle-check" aria-hidden="true" />
                  {fileInfo.name} · {(fileInfo.size / 1024).toFixed(1)} Ko
                </p>
              )}

              {/* Format détecté ≠ mode actif → bascule en un clic */}
              {importHint && (
                <div className="mt-2.5 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-mustard/50 bg-mustard/10 px-3.5 py-2.5">
                  <p className="text-xs leading-relaxed text-ink-soft">
                    <i className="fa-solid fa-wand-magic-sparkles mr-1.5 text-mustard-dark" aria-hidden="true" />
                    {importHint.detected === 'lrc'
                      ? 'Horodatages LRC détectés dans ce fichier — le mode actif est TXT.'
                      : 'Aucun horodatage détecté — ce fichier semble être du texte brut.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat(importHint.detected)
                      if (prefillRaw) {
                        setLyrics(applyFormat(prefillRaw, importHint.detected))
                        setPrefilled(true)
                      }
                      setImportHint(null)
                    }}
                    className="shrink-0 rounded-full border border-mustard bg-card px-3 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-mustard-dark transition-colors hover:bg-mustard hover:text-white"
                  >
                    Utiliser le format {importHint.detected.toUpperCase()}
                  </button>
                </div>
              )}
            </div>

            <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-ink">
              {format === 'lrc' ? 'Paroles au format LRC' : 'Paroles (texte brut)'}
              <textarea
                value={lyrics}
                onChange={(e) => {
                  setLyrics(e.target.value)
                  setPrefilled(false)
                }}
                rows={12}
                required
                minLength={20}
                autoFocus
                onKeyDown={(e) => {
                  // Cmd/Ctrl + Entrée : envoi direct sans toucher la souris.
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder={
                  format === 'lrc'
                    ? '[00:14.07]Premier vers…\n[00:18.00]Second vers…'
                    : 'Premier vers…\nSecond vers…'
                }
                className="input min-h-[220px] resize-y py-3 font-mono text-sm leading-relaxed"
              />
            </label>

            {prefillLoading && (
              <p className="mt-2 text-xs text-ink-soft">
                <i className="fa-solid fa-spinner fa-spin mr-1.5" aria-hidden="true" />
                Paroles trouvées dans le catalogue — pré-remplissage…
              </p>
            )}
            {!prefillLoading && selected.hasLyrics && (
              <p className="mt-2 text-xs text-ink-soft">
                <i className="fa-solid fa-circle-check mr-1.5 text-green" aria-hidden="true" />
                Pass&apos;io possède déjà des paroles pour ce titre : vérifiez et complétez.
              </p>
            )}
            {!prefillLoading && !selected.hasLyrics && (
              <p className="mt-2 text-xs text-ink-soft">
                Ce titre n&apos;a pas encore de paroles dans le catalogue — vous êtes la première voix.
              </p>
            )}

            {/* ── Aperçu de la proposition avant l'envoi ── */}
            {lyrics.length > 0 && (
              <div
                className={`mt-4 rounded-xl border p-4 transition-colors ${
                  previewReady ? 'border-green/50 bg-green/5' : 'border-line-strong bg-paper-alt'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-ink-soft">
                    <i className="fa-solid fa-eye mr-1.5" aria-hidden="true" />
                    Aperçu de la proposition
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] ${
                        format === 'lrc'
                          ? 'border-mustard bg-mustard/10 text-mustard-dark'
                          : 'border-line-strong bg-card text-ink-soft'
                      }`}
                    >
                      {format.toUpperCase()}
                    </span>
                    <span className="font-mono text-[0.6rem] tabular-nums text-ink-faint">
                      {lyricLines.length} ligne{lyricLines.length > 1 ? 's' : ''} · {lyrics.length} car.
                    </span>
                  </div>
                </div>
                <pre className="mt-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-card px-3.5 py-3 font-mono text-[0.78rem] leading-relaxed text-ink-soft">
                  {previewLines}
                  {previewTruncated && (
                    <span className="text-ink-faint">
                      {'\n'}… (+{lyricLines.length - PREVIEW_MAX_LINES} ligne
                      {lyricLines.length - PREVIEW_MAX_LINES > 1 ? 's' : ''})
                    </span>
                  )}
                </pre>
                {!previewReady && (
                  <p className="mt-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-red">
                    <i className="fa-solid fa-circle-info mr-1" aria-hidden="true" />
                    Minimum 20 caractères pour l&apos;envoi
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-red">
                <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                    Proposer ce titre
                  </>
                )}
              </button>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.15em] text-ink-faint">
                Proposition en tant que @{username}
              </span>
            </div>
          </form>
        )}

        {step === 'done' && result && (
          <div>
            <div className="rounded-xl border-2 border-green bg-green/10 p-5 text-sm text-ink">
              <p className="font-semibold">
                <i className="fa-solid fa-circle-check mr-2 text-green" aria-hidden="true" />
                {result.published ? 'Publié automatiquement !' : 'Proposition envoyée !'}
              </p>
              <p className="mt-1 text-ink-soft">
                {result.published
                  ? 'Votre titre est en ligne dans le catalogue, prêt à être annoté.'
                  : 'Merci ! Votre ajout sera relu par l’équipe avant publication.'}
                {result.quotaLeft > 0
                  ? ` Il vous reste ${result.quotaLeft} ajout${result.quotaLeft > 1 ? 's' : ''} aujourd'hui.`
                  : ' Vous avez atteint votre quota du jour.'}
              </p>
              {result.commitUrl && (
                <p className="mt-2">
                  <a
                    href={result.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-red hover:underline"
                  >
                    <i className="fa-brands fa-github mr-1.5" aria-hidden="true" />
                    Voir le commit
                  </a>
                </p>
              )}
            </div>
            <button type="button" onClick={reset} className="btn btn-secondary mt-5">
              <i className="fa-solid fa-plus" aria-hidden="true" /> Ajouter un autre titre
            </button>
          </div>
        )}
      </div>

      {/* ── Vos propositions ── */}
      {recent.length > 0 && (
        <div>
          <span className="eyebrow">
            <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /> Vos propositions
          </span>
          <ul className="card mt-3 divide-y divide-[var(--line)] overflow-hidden">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[15px] font-semibold text-ink">
                    {s.track_title}
                  </span>
                  <span className="block truncate text-sm text-ink-soft">
                    {s.artist_name}
                    {s.album_title ? ` · ${s.album_title}` : ''} — {s.lyrics_format.toUpperCase()}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] ${
                    s.status === 'merged' ? 'text-green' : s.status === 'rejected' ? 'text-red' : 'text-mustard-dark'
                  }`}
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
