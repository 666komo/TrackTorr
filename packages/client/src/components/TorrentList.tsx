import type { TorrentStatus } from '../types'
import { useLang } from '../i18n'

interface TorrentListProps {
  torrents: TorrentStatus[]
  onRemove: (infoHash: string) => void
  onPlay: (infoHash: string, fileIndex: number, name: string) => void
  wide?: boolean
}

export default function TorrentList({ torrents, onRemove, onPlay, wide }: TorrentListProps) {
  const { t } = useLang()

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
        {torrents.map((t) => (
          <div
            key={t.infoHash}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <button
              onClick={() => onPlay(t.infoHash, t.files[0]?.index ?? 0, t.name)}
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
              {t.name}
            </button>
            <button
              onClick={() => onRemove(t.infoHash)}
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
        ))}
      </div>
    </div>
  )
}


