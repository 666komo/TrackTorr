import type { TorrentStatus } from '../types'

interface TorrentListProps {
  torrents: TorrentStatus[]
  onRemove: (infoHash: string) => void
  onPlay: (infoHash: string, fileIndex: number, name: string) => void
}

function formatSpeed(bytes: number): string {
  if (bytes === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === Infinity) return '—'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function TorrentList({ torrents, onRemove, onPlay }: TorrentListProps) {
  if (torrents.length === 0) {
    return (
      <div style={{ color: '#999', marginTop: 24 }}>
        No active torrents. Search and add one above.
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Active Torrents ({torrents.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {torrents.map((t) => (
          <div
            key={t.infoHash}
            style={{
              padding: '12px',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </div>
              <button
                onClick={() => onRemove(t.infoHash)}
                style={{
                  marginLeft: 12,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #cc0000',
                  background: 'transparent',
                  color: '#cc0000',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Remove
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              DL: {formatSpeed(t.downloadSpeed)} &middot; UL: {formatSpeed(t.uploadSpeed)}
              &middot; Peers: {t.peers}
              &middot; ETA: {formatDuration(t.timeRemaining)}
              &middot; {(t.progress * 100).toFixed(1)}%
            </div>

            <div
              style={{
                height: 4,
                background: '#e0e0e0',
                borderRadius: 2,
                marginBottom: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${t.progress * 100}%`,
                  height: '100%',
                  background: t.progress >= 1 ? '#22c55e' : '#0066cc',
                  borderRadius: 2,
                  transition: 'width 1s',
                }}
              />
            </div>

            {t.files.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {t.files.map((f) => (
                  <button
                    key={f.index}
                    onClick={() => onPlay(t.infoHash, f.index, f.name)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid #22c55e',
                      background: 'transparent',
                      color: '#22c55e',
                      cursor: 'pointer',
                      fontSize: 11,
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={f.name}
                  >
                    Play: {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
