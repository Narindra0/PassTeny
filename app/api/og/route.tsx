import { ImageResponse } from 'next/og'

/**
 * Carte de partage statique (OG image) — 1200×630, façon citation.
 *
 * Utilisation : /api/og?title=…&artist=…&quote=…
 * Servie en tant qu'og:image sur les pages titres (meta générée) et
 * partageable via le bouton « Carte partageable » (Stories, réseaux).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('title') ?? 'Pass\u2019Teny').slice(0, 120)
  const artist = (searchParams.get('artist') ?? '').slice(0, 80)
  const quote = (searchParams.get('quote') ?? '').slice(0, 300)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0c0a09',
          color: '#fafaf9',
          padding: '72px 84px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
            Pass<span style={{ color: '#f59e0b' }}>&apos;</span>Teny
          </div>
          <div style={{ fontSize: 28, color: '#a8a29e' }}>Ny hevitry ny teny</div>
        </div>

        {/* Citation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 96, lineHeight: 1, color: '#f59e0b', fontFamily: 'serif' }}>&ldquo;</div>
          <div
            style={{
              fontSize: 56,
              lineHeight: 1.25,
              fontWeight: 600,
              color: '#fafaf9',
              display: '-webkit-box',
            }}
          >
            {quote || title}
          </div>
        </div>

        {/* Pied : titre + artiste + marque */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 44, fontWeight: 700 }}>{title}</div>
            {artist && <div style={{ fontSize: 32, color: '#d6d3d1' }}>{artist}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <div style={{ fontSize: 24, color: '#a8a29e' }}>teny.passiio.shop</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
