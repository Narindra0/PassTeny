import { ImageResponse } from 'next/og'
import { cloudinaryToImageKitUrl, IMAGEKIT_BASE_URL } from '@/lib/imageUtils'

/** Palette lamba déclinée sur fond encre — mêmes tokens que le design system. */
const COLORS = {
  ink: '#211b12',
  paper: '#f7f1e4',
  paperSoft: '#d8ceb4',
  card: '#fffdf7',
  red: '#a63a2b',
  green: '#43633f',
  gold: '#c4912e',
  goldLight: '#d9ab57',
}

/**
 * Récupère une police Google Fonts en woff2 (pour satori / next/og).
 * Nécessaire car next/font/google génère des .woff2 que esbuild
 * ne sait pas bundler sur Cloudflare Pages (OpenNext).
 */
async function fetchGoogleFont(
  family: string,
  weight: number,
  style: 'normal' | 'italic' = 'normal',
): Promise<{ name: string; data: ArrayBuffer }> {
  const familyParam = family.replace(/ /g, '+')
  const styleParam = style === 'italic' ? '1' : '0'
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:ital,wght@${styleParam},${weight}&display=swap`
  const cssRes = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  const css = await cssRes.text()
  const woff2Match = css.match(/url\((https:\/\/[^)]+\.woff2)\)/)
  if (!woff2Match) throw new Error(`No woff2 found for ${family}`)
  const fontRes = await fetch(woff2Match[1])
  const data = await fontRes.arrayBuffer()
  return { name: family, data }
}

/** Frise tissée — la signature lamba, déclinée sur fond encre. */
function LambaBand() {
  const segments = [
    { color: COLORS.red, width: 56 },
    { color: COLORS.paper, width: 22 },
    { color: COLORS.green, width: 56 },
    { color: COLORS.gold, width: 30 },
  ]
  return (
    <div style={{ display: 'flex', width: '100%' }}>
      {segments.map((seg, i) => (
        <div key={i} style={{ width: seg.width, height: 6, backgroundColor: seg.color }} />
      ))}
    </div>
  )
}

/** Le losange tissé (2×2 latérite/ivoire/vert/or) — la marque Pass'Teny. */
function LambaMark({ size = 30, border = 'rgba(247,241,228,0.6)' }: { size?: number; border?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        transform: 'rotate(45deg)',
        borderRadius: 5,
        border: `2px solid ${border}`,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
        <div style={{ flex: 1, backgroundColor: COLORS.red }} />
        <div style={{ flex: 1, backgroundColor: COLORS.green }} />
      </div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
        <div style={{ flex: 1, backgroundColor: COLORS.paper }} />
        <div style={{ flex: 1, backgroundColor: COLORS.gold }} />
      </div>
    </div>
  )
}

/**
 * Carte de partage — 1200×630, façon « carte Spotify » aux couleurs Pass'Teny :
 * cover + titre + artiste en tête, passage de paroles centré, marque en pied.
 *
 * Utilisation : /api/og?title=…&artist=…&quote=…&cover=…
 * (cover : URL Cloudinary convertie en ImageKit, ou ImageKit directe)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('title') ?? "Pass'Teny").slice(0, 120)
  const artist = (searchParams.get('artist') ?? '').slice(0, 80)
  const quote = (searchParams.get('quote') ?? '').trim().slice(0, 300)
  const rawCover = (searchParams.get('cover') ?? '').slice(0, 500)
  const origin = new URL(request.url).origin

  // Cover affichable : ImageKit directe, ou équivalent ImageKit d'une Cloudinary.
  let coverUrl = ''
  if (rawCover) {
    const converted = cloudinaryToImageKitUrl(rawCover)
    if (converted) coverUrl = converted
    else if (rawCover.includes(IMAGEKIT_BASE_URL)) coverUrl = rawCover.split('?')[0] || ''
  }
  if (coverUrl) {
    coverUrl = `${coverUrl}?tr=w-300,q-80,f-auto`
  }

  // Citation bornée à ~6 lignes : les paroles descendent librement dans la carte.
  const shortQuote =
    quote.length > 250 ? `${quote.slice(0, 247).trimEnd()}…` : quote

  // Polices récupérées en runtime (évite next/font/google → .woff2 → esbuild error)
  const [frauncesNormal, frauncesItalic, splineFont, splineMonoFont] =
    await Promise.all([
      fetchGoogleFont('Fraunces', 600, 'normal'),
      fetchGoogleFont('Fraunces', 600, 'italic'),
      fetchGoogleFont('Spline Sans', 400),
      fetchGoogleFont('Spline Sans Mono', 500),
    ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: COLORS.ink,
          color: COLORS.paper,
          fontFamily: 'Fraunces',
        }}
      >
        <LambaBand />

        {/* Corps */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '52px 72px 44px',
          }}
        >
          {/* En-tête : cover + titre + artiste */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- satori (next/og) exige <img> brut ; alt vide car la cover est redondante avec titre/artiste */
              <img
                src={coverUrl}
                width={112}
                height={112}
                alt=""
                style={{
                  borderRadius: 20,
                  objectFit: 'cover',
                  border: '3px solid rgba(247,241,228,0.18)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: 112,
                  height: 112,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.card,
                  borderRadius: 20,
                  flexShrink: 0,
                }}
              >
                <LambaMark size={56} border={COLORS.ink} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 46,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  color: COLORS.paper,
                  maxWidth: 820,
                }}
              >
                {title}
              </div>
              {artist && (
                <div
                  style={{
                    display: 'flex',
                    marginTop: 8,
                    fontFamily: 'Spline Sans',
                    fontSize: 24,
                    fontWeight: 400,
                    color: COLORS.paperSoft,
                  }}
                >
                  {artist}
                </div>
              )}
            </div>
          </div>

          {/* Passage centré — les paroles descendent librement, « » en cadres détachés */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {shortQuote ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 14,
                  width: 920,
                }}
              >
                <span
                  style={{
                    color: COLORS.goldLight,
                    fontSize: 44,
                    lineHeight: 1,
                    paddingTop: 4,
                  }}
                >
                  «
                </span>
                <div
                  style={{
                    display: 'flex',
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                    fontStyle: 'italic',
                    fontWeight: 500,
                    lineHeight: 1.32,
                    textAlign: 'center',
                    color: COLORS.paper,
                  }}
                >
                  {shortQuote}
                </div>
                <span
                  style={{
                    color: COLORS.goldLight,
                    fontSize: 44,
                    lineHeight: 1,
                    alignSelf: 'flex-end',
                    paddingBottom: 4,
                  }}
                >
                  »
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 58,
                    fontWeight: 600,
                    lineHeight: 1.15,
                    color: COLORS.paper,
                    maxWidth: 900,
                    textAlign: 'center',
                  }}
                >
                  {title}
                </div>
                {artist && (
                  <div
                    style={{
                      display: 'flex',
                      marginTop: 14,
                    fontFamily: 'Spline Sans',
                    fontSize: 26,
                    fontWeight: 400,
                    color: COLORS.paperSoft,
                    }}
                  >
                    {artist}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pied : logo Pass'io + tagline */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- logo Pass'io blanc (asset local), alt = nom de la marque */}
            <img
              src={`${origin}/passio-logo-white.png`}
              width={152}
              height={56}
              alt="Pass'io"
              style={{ objectFit: 'contain', flexShrink: 0 }}
            />
            <div
              style={{
                display: 'flex',
                fontFamily: 'Spline Sans Mono',
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: COLORS.gold,
              }}
            >
              Ny hevitry ny teny
            </div>
          </div>
        </div>

        <LambaBand />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [frauncesNormal, frauncesItalic, splineFont, splineMonoFont],
    }
  )
}
