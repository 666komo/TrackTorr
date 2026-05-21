import type { IndexerResult } from '../types'

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
  if (results.length === 0) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: 'var(--text)' }}>
        Search Results
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({results.length})</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {results.map((r, i) => (
          <div
            key={`${r.guid}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                {r.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                <span style={{ color: 'var(--primary)' }}>{r.indexer}</span>
                {' \u00b7 '}{formatSize(r.size)}
                {' \u00b7 '}
                <span style={{ color: 'var(--success)' }}>S:{r.seeders}</span>
                {' L:'}{r.leechers}
              </div>
            </div>
            {r.magnetUrl && (
              <button
                onClick={() => onAdd(r.magnetUrl!)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 4,
                  border: '1px solid var(--primary)',
                  background: 'transparent',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                Add
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
