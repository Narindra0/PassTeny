import { ImageResponse } from 'next/og'
import { cloudinaryToImageKitUrl, IMAGEKIT_BASE_URL } from '@/lib/imageUtils'

/** Palette lamba déclinée sur fond encre — mêmes tokens que le design system. */
const COLORS = {
  ink: '#211b12',
  paper: '#f7f1e4',
  paperSoft: '#d8ceb4',
  paperFaint: '#a79d88',
  card: '#fffdf7',
  red: '#a63a2b',
  green: '#43633f',
  gold: '#c4912e',
  goldLight: '#d9ab57',
}

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
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
    },
  })
  const css = await cssRes.text()
  const woffMatch = css.match(/url\((https:\/\/[^)]+\.woff)\)/)
  const woff2Match = css.match(/url\((https:\/\/[^)]+\.woff2)\)/)
  const fontUrl = woffMatch?.[1] ?? woff2Match?.[1]
  if (!fontUrl) throw new Error(`No font found for ${family}`)
  const fontRes = await fetch(fontUrl)
  const data = await fontRes.arrayBuffer()
  return { name: family, data }
}

/** Frise tissée — la signature lamba. */
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
        <div key={i} style={{ width: seg.width, height: 5, backgroundColor: seg.color }} />
      ))}
    </div>
  )
}

/**
 * Résout les sauts de ligne du texte en lignes React.
 * Chaque ligne est un <div> flex séparé (satori exige display:flex).
 */
function renderMultilineText(text: string, style: Record<string, unknown>) {
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex' }}>
          {line || '\u00A0'}
        </div>
      ))}
    </div>
  )
}

/**
 * Carte de partage — 1200×630, style « carte Spotify / Genius » :
 * cover grande à gauche, titre + artiste, citation au centre, logo Pass'io en pied.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('title') ?? "Pass'Teny").slice(0, 120)
  const artist = (searchParams.get('artist') ?? '').slice(0, 80)
  const quote = (searchParams.get('quote') ?? '').trim().slice(0, 300)
  const rawCover = (searchParams.get('cover') ?? '').slice(0, 500)
  const origin = new URL(request.url).origin

  let coverUrl = ''
  if (rawCover) {
    const converted = cloudinaryToImageKitUrl(rawCover)
    if (converted) coverUrl = converted
    else if (rawCover.includes(IMAGEKIT_BASE_URL)) coverUrl = rawCover.split('?')[0] || ''
  }
  if (coverUrl) {
    coverUrl = `${coverUrl}?tr=w-500,q-85,f-auto`
  }

  // Borné mais PAS tronqué sur les lignes — les \n sont conservés pour l'affichage multi-ligne.
  const shortQuote =
    quote.length > 280 ? `${quote.slice(0, 277).trimEnd()}…` : quote

  const [frauncesNormal, frauncesItalic, splineFont] =
    await Promise.all([
      fetchGoogleFont('Fraunces', 600, 'normal'),
      fetchGoogleFont('Fraunces', 600, 'italic'),
      fetchGoogleFont('Spline Sans', 400),
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

        {/* Corps principal — layout horizontal */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            padding: '48px 60px 40px',
            gap: 48,
          }}
        >
          {/* Colonne gauche — cover + métadonnées, centré verticalement */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 320,
              flexShrink: 0,
            }}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                width={280}
                height={280}
                alt=""
                style={{
                  borderRadius: 24,
                  objectFit: 'cover',
                  border: `4px solid ${COLORS.paper}18`,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: 280,
                  height: 280,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.card,
                  borderRadius: 24,
                  border: `4px solid ${COLORS.paper}18`,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ fontSize: 48, color: COLORS.gold }}>♪</div>
              </div>
            )}

            {/* Titre + artiste sous la cover */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: 24,
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 26,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  color: COLORS.paper,
                  textAlign: 'center',
                  maxWidth: 280,
                }}
              >
                {title}
              </div>
              {artist && (
                <div
                  style={{
                    display: 'flex',
                    marginTop: 6,
                    fontFamily: 'Spline Sans',
                    fontSize: 18,
                    fontWeight: 400,
                    color: COLORS.paperSoft,
                    textAlign: 'center',
                  }}
                >
                  {artist}
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite — citation multi-ligne + marque Pass'io */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
            }}
          >
            {shortQuote ? (
              <>
                {/* Guillemets décoratifs */}
                <div
                  style={{
                    display: 'flex',
                    color: COLORS.goldLight,
                    fontSize: 72,
                    lineHeight: 0.8,
                    marginBottom: 8,
                    opacity: 0.6,
                  }}
                >
                  «
                </div>

                {/* Citation — multi-ligne avec préservation des \n */}
                {renderMultilineText(shortQuote, {
                  fontSize: 34,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: COLORS.paper,
                  paddingLeft: 28,
                })}

                {/* Guillemets fermant */}
                <div
                  style={{
                    display: 'flex',
                    color: COLORS.goldLight,
                    fontSize: 72,
                    lineHeight: 0.8,
                    marginTop: 12,
                    alignSelf: 'flex-end',
                    opacity: 0.6,
                  }}
                >
                  »
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: 52,
                    fontWeight: 600,
                    lineHeight: 1.15,
                    color: COLORS.paper,
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

            {/* Pied — Logo Pass'io + tagline Pass'Teny */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 32,
                paddingTop: 20,
                borderTop: `1px solid ${COLORS.paper}15`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- logo Pass'io blanc, asset local */}
              <img
                src={`${origin}/passio-logo-white.png`}
                width={140}
                height={50}
                alt="Pass'io"
                style={{ objectFit: 'contain', flexShrink: 0 }}
              />
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Spline Sans',
                  fontSize: 13,
                  color: COLORS.paperFaint,
                }}
              >
                Ny hevitry ny teny
              </div>
            </div>
          </div>
        </div>

        <LambaBand />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [frauncesNormal, frauncesItalic, splineFont],
    }
  )
}
