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
    <div style={{ marginBottom: 24, animation: 'slideUp .35s ease' }}>
      <h3 style={{
        margin: '0 0 14px 4px',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {t('results.heading')}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> &middot; {results.length}</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map((r, i) => (
          <div
            key={`${r.guid}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow)',
              transition: 'all .15s ease',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600,
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--text)',
                marginBottom: 4,
              }}>
                {r.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  padding: '1px 8px',
                  borderRadius: 4,
                  background: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {r.indexer}
                </span>
                <span>{formatSize(r.size)}</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>
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
                  padding: '8px 20px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: '0 2px 6px var(--primary-glow)',
                  transition: 'all .15s ease',
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
