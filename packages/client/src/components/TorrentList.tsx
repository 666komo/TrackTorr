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
  mp4: '#46ebeb', mkv: '#7C4DFF', avi: '#FCEE0C',
  mov: '#00ff88', webm: '#FB0A26', m4v: '#46ebeb',
  mp3: '#FFD600', flac: '#7C4DFF', wav: '#00ff88', ogg: '#FCEE0C',
  mka: '#7C4DFF', m4a: '#46ebeb', aac: '#00ff88',
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
        {t('torrents.heading')}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}> &middot; {torrents.length}</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                transition: 'all .2s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'var(--shadow)'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '3px',
                height: '100%',
                background: 'linear-gradient(180deg, var(--danger), var(--primary))',
                opacity: 0.7,
              }} />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px 12px 20px',
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
                      gap: 10,
                    }}
                  >
                    <span style={{
                      fontSize: 10,
                      color: 'var(--primary)',
                      transition: 'transform .2s ease',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                      flexShrink: 0,
                      textShadow: '0 0 4px var(--primary)',
                    }}>&#9654;</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tor.name}</span>
                    <span style={{
                      fontSize: 10,
                      color: 'var(--danger)',
                      fontWeight: 700,
                      flexShrink: 0,
                      padding: '2px 8px',
                      background: 'var(--danger-bg)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--danger)',
                      textShadow: '0 0 4px var(--danger)',
                    }}>{files.length} FILES</span>
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
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all .2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--danger)'
                    e.currentTarget.style.boxShadow = 'var(--glow-violet)'
                    e.currentTarget.style.background = 'var(--danger-bg)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  &#10005;
                </button>
              </div>

              {multi && isOpen && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '6px 0',
                  background: 'var(--bg-muted)',
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
                          gap: 12,
                          width: '100%',
                          padding: '10px 16px 10px 32px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: 'var(--text)',
                          transition: 'all .15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-hover)'
                          e.currentTarget.style.paddingLeft = '36px'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.paddingLeft = '32px'
                        }}
                      >
                        {badge && (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius)',
                            background: badge,
                            color: '#000',
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            lineHeight: '1.4',
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${badge}`,
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


