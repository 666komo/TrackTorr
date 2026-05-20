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
      <h3>Search Results ({results.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map((r, i) => (
          <div
            key={`${r.guid}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {r.indexer} &middot; {formatSize(r.size)} &middot; S:{r.seeders} L:{r.leechers}
              </div>
            </div>
            {r.magnetUrl && (
              <button
                onClick={() => onAdd(r.magnetUrl!)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  border: '1px solid #0066cc',
                  background: 'transparent',
                  color: '#0066cc',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
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
