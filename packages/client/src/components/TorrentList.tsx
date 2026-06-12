import { useState } from 'react'
import type { TorrentStatus, TorrentFile } from '../types'
import { useLang } from '../i18n'

interface TorrentListProps {
  torrents: TorrentStatus[]
  onRemove: (infoHash: string) => void
  onPlay: (infoHash: string, fileIndex: number, name: string) => void
  wide?: boolean
}

const extBadge: Record<string, string> = {
  mp4: '#6366f1', mkv: '#8b5cf6', avi: '#eab308',
  mov: '#06b6d4', webm: '#dc2626', m4v: '#0891b2',
  mp3: '#d97706', flac: '#a855f7', wav: '#0ea5e9', ogg: '#65a30d',
  mka: '#a855f7', m4a: '#0891b2', aac: '#0891b2',
}

function getExt(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts[parts.length - 1] || ''
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function TorrentList({ torrents, onRemove, onPlay, wide }: TorrentListProps) {
  const { t } = useLang()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (torrents.length === 0) {
    return (
      <div style={{
        color: 'var(--text-muted)',
        textAlign: 'center',
        marginTop: 48,
        fontSize: 14,
        lineHeight: 1.8,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#9835;</div>
        {t('torrents.empty')}
        <br />
        <span style={{ fontSize: 13 }}>{t('torrents.empty_hint')}</span>
      </div>
    )
  }

  const toggleExpand = (infoHash: string) => {
    setExpanded((prev) => ({ ...prev, [infoHash]: !prev[infoHash] }))
  }

  const playableFiles = (files: TorrentFile[]) => {
    const hasSelection = files.some((f) => f.selected)
    if (!hasSelection) return files
    return files.filter((f) => f.selected)
  }

  return (
    <div style={{ marginTop: wide ? 0 : 28 }}>
      <h3 style={{
        margin: '0 0 14px 4px',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {t('torrents.heading')}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> &middot; {torrents.length}</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {torrents.map((tor) => {
          const files = playableFiles(tor.files)
          const multi = files.length > 1
          const isOpen = expanded[tor.infoHash]

          return (
            <div
              key={tor.infoHash}
              style={{
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
              }}>
                {multi ? (
                  <button
                    onClick={() => toggleExpand(tor.infoHash)}
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--text)',
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      transition: 'transform .15s ease',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}>&#9654;</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tor.name}</span>
                    <span style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                      flexShrink: 0,
                    }}>{files.length} files</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onPlay(tor.infoHash, files[0]?.index ?? 0, files[0]?.name ?? tor.name)}
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--text)',
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {tor.name}
                  </button>
                )}
                <button
                  onClick={() => onRemove(tor.infoHash)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    flexShrink: 0,
                    transition: 'color .15s ease',
                  }}
                >
                  &#10005;
                </button>
              </div>

              {multi && isOpen && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '4px 0',
                }}>
                  {files.map((file) => {
                    const ext = getExt(file.name)
                    const badge = extBadge[ext]
                    return (
                      <button
                        key={file.index}
                        onClick={() => onPlay(tor.infoHash, file.index, file.name)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '8px 14px 8px 28px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: 'var(--text)',
                          transition: 'background .1s ease',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, rgba(255,255,255,0.03))' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        {badge && (
                          <span style={{
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: badge,
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            lineHeight: '1.4',
                            flexShrink: 0,
                          }}>
                            {ext}
                          </span>
                        )}
                        <span style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                        }}>
                          {file.name}
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {fmtSize(file.length)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


