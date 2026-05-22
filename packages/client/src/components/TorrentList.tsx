import { useState } from 'react'
import type { TorrentStatus, TorrentFile } from '../types'

interface TorrentListProps {
  torrents: TorrentStatus[]
  onRemove: (infoHash: string) => void
  onPlay: (infoHash: string, fileIndex: number, name: string) => void
  onSelectFiles: (infoHash: string, files: number[]) => void
  onDeselectFiles: (infoHash: string, files: number[]) => void
}

function formatSpeed(bytes: number): string {
  if (bytes === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === Infinity) return '\u2014'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'var(--success)'
    case 'downloading': return 'var(--primary)'
    case 'error': return 'var(--danger)'
    default: return 'var(--text-muted)'
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function TorrentList({ torrents, onRemove, onPlay, onSelectFiles, onDeselectFiles }: TorrentListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  function toggleCollapse(infoHash: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(infoHash)) {
        next.delete(infoHash)
      } else {
        next.add(infoHash)
      }
      return next
    })
  }

  function handleFileClick(t: TorrentStatus, f: TorrentFile) {
    if (!f.streamable && !f.selected) {
      onSelectFiles(t.infoHash, [f.index])
    }
    onPlay(t.infoHash, f.index, f.name)
  }

  if (torrents.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 1.6 }}>
        No active torrents.
        <br />
        <span style={{ fontSize: 13 }}>Search and add one above.</span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: 'var(--text)' }}>
        Active Torrents
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({torrents.length})</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {torrents.map((t) => {
          const isCollapsed = collapsed.has(t.infoHash)
          return (
            <div
              key={t.infoHash}
              style={{
                padding: '12px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  onClick={() => toggleCollapse(t.infoHash)}
                  style={{
                    fontWeight: 500,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text)',
                    fontSize: 14,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title="Click to collapse/expand"
                >
                  {isCollapsed ? '\u25B6 ' : '\u25BC '}{t.name}
                </div>
                <button
                  onClick={() => onRemove(t.infoHash)}
                  style={{
                    marginLeft: 12,
                    padding: '3px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--danger)',
                    background: 'transparent',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              </div>

              {!isCollapsed && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>DL: {formatSpeed(t.downloadSpeed)}</span>
                    <span>UL: {formatSpeed(t.uploadSpeed)}</span>
                    <span>Peers: {t.peers}</span>
                    <span>ETA: {formatDuration(t.timeRemaining)}</span>
                    <span style={{ color: statusColor(t.status) }}>{(t.progress * 100).toFixed(1)}%</span>
                  </div>

                  {t.progress > 0 && (
                    <div style={{ height: 4, background: 'var(--bg-muted)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${t.progress * 100}%`,
                          height: '100%',
                          background: t.progress >= 1 ? 'var(--success)' : 'var(--primary)',
                          borderRadius: 2,
                          transition: 'width 1s ease',
                        }}
                      />
                    </div>
                  )}

                  {t.files.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {t.files.map((f) => (
                        <div key={f.index} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            onClick={() => handleFileClick(t, f)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '3px 10px',
                              borderRadius: 4,
                              border: f.streamable
                                ? '1px solid var(--success)'
                                : f.selected
                                  ? '1px solid var(--primary)'
                                  : '1px solid var(--text-muted)',
                              background: 'transparent',
                              color: f.streamable
                                ? 'var(--success)'
                                : f.selected
                                  ? 'var(--primary)'
                                  : 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: 11,
                              textAlign: 'left',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={`${f.name} (${formatSize(f.length)})`}
                          >
                            {f.streamable ? '\u25B6 ' : f.selected ? '\u25CF ' : ''}{f.name}
                          </button>
                          {(f.streamable || f.selected) && (
                            <button
                              onClick={() => onDeselectFiles(t.infoHash, [f.index])}
                              style={{
                                padding: '3px 7px',
                                borderRadius: 4,
                                border: '1px solid var(--danger)',
                                background: 'transparent',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                fontSize: 10,
                                flexShrink: 0,
                              }}
                              title="Remove this file"
                            >
                              \u2716
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
