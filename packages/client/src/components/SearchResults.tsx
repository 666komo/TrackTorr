import type { IndexerResult } from '../types'
import { useLang } from '../i18n'

interface SearchResultsProps {
  results: IndexerResult[]
  onAdd: (magnet: string) => void
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function SearchResults({ results, onAdd }: SearchResultsProps) {
  const { t } = useLang()
  if (results.length === 0) return null

  return (
    <div style={{ marginBottom: 28, animation: 'slideUp .35s ease' }}>
      <h3 style={{
        margin: '0 0 16px 4px',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--primary)',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        fontFamily: "'Orbitron', sans-serif",
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: 'var(--danger)',
          boxShadow: '0 0 8px var(--danger)',
          animation: 'neonPulse 2s ease-in-out infinite',
        }} />
        {t('results.heading')}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}> &middot; {results.length}</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.map((r, i) => (
          <div
            key={`${r.guid}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 18px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow)',
              transition: 'all .2s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)'
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
              e.currentTarget.style.transform = 'translateX(4px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'var(--shadow)'
              e.currentTarget.style.transform = 'translateX(0)'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '3px',
              height: '100%',
              background: 'linear-gradient(180deg, var(--danger), var(--primary))',
              opacity: 0,
              transition: 'opacity .2s ease',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600,
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--text)',
                marginBottom: 6,
              }}>
                {r.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  border: '1px solid var(--danger)',
                  boxShadow: '0 0 6px var(--danger-bg)',
                }}>
                  {r.indexer}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{formatSize(r.size)}</span>
                <span style={{ color: 'var(--success)', fontWeight: 700, textShadow: '0 0 4px var(--success)' }}>
                  S:{r.seeders}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  L:{r.leechers}
                </span>
              </div>
            </div>
            {r.magnetUrl && (
              <button
                onClick={() => onAdd(r.magnetUrl!)}
                style={{
                  padding: '10px 24px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--danger), var(--primary))',
                  color: '#000',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontFamily: "'Orbitron', sans-serif",
                  boxShadow: 'var(--glow-cyan)',
                  transition: 'all .2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--glow-cyan)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {t('results.add')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
