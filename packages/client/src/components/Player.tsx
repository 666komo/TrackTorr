import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

interface PlayerProps {
  streamUrl: string
  fileName: string
  infoHash: string
  fileIndex: number
  onClose: () => void
}

interface ProbeResult {
  has_eac3: boolean
  supported: boolean
  error?: string
}

const extBadge: Record<string, string> = {
  mp4: '#2563eb',
  mkv: '#7c3aed',
  avi: '#ca8a04',
  mov: '#059669',
  webm: '#dc2626',
  m4v: '#0891b2',
  mp3: '#d97706',
  flac: '#9333ea',
  wav: '#0284c7',
  ogg: '#65a30d',
}

function getExt(fileName: string): string {
  const parts = fileName.toLowerCase().split('.')
  return parts[parts.length - 1] || ''
}

export default function Player({ streamUrl, fileName, infoHash, fileIndex, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [state, setState] = useState<'probing' | 'preparing' | 'playing' | 'error'>('probing')
  const [useTranscode, setUseTranscode] = useState<boolean | null>(null)
  const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']
  const isVideo = videoExts.some((ext) => fileName.toLowerCase().endsWith(ext))
  const ext = getExt(fileName)

  useEffect(() => {
    let cancelled = false
    fetch(api.probeUrl(infoHash, fileIndex))
      .then((r) => r.json())
      .then((data: ProbeResult) => {
        if (cancelled) return
        if (!data.supported && data.has_eac3) {
          setWarning('Unsupported audio codec detected \u2014 transcoding audio to AAC for browser playback.')
          setUseTranscode(true)
        } else if (data.error) {
          setUseTranscode(false)
        } else {
          setUseTranscode(false)
        }
      })
      .catch(() => { if (!cancelled) setUseTranscode(false) })
    return () => { cancelled = true }
  }, [infoHash, fileIndex])

  useEffect(() => {
    if (useTranscode === null) return
    const el = isVideo ? videoRef.current : audioRef.current
    if (!el) return

    const src = useTranscode ? api.transcodeUrl(infoHash, fileIndex) : streamUrl
    setError('')
    setState('preparing')

    const onWaiting = () => setState('preparing')
    const onCanPlay = () => setState('playing')
    const onEnded = () => setState('playing')
    const onError = () => {
      const ec = (el as HTMLMediaElement).error
      if (ec) {
        const codes = ['', 'MEDIA_ERR_ABORTED', 'MEDIA_ERR_NETWORK', 'MEDIA_ERR_DECODE', 'MEDIA_ERR_SRC_NOT_SUPPORTED']
        setError(`Playback error: ${codes[ec.code] || ec.code}${ec.message ? ' (' + ec.message + ')' : ''}`)
      } else {
        setError('Failed to load stream')
      }
      setState('error')
    }

    el.addEventListener('waiting', onWaiting)
    el.addEventListener('canplay', onCanPlay)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)

    el.src = src
    el.load()
    el.play().catch((e: DOMException) => {
      if (e.name === 'NotAllowedError') {
        setError('Click Play to start')
      }
    })

    return () => {
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
      el.src = ''
    }
  }, [streamUrl, isVideo, useTranscode, infoHash, fileIndex])

  const extColor = extBadge[ext] || 'var(--text-muted)'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--player-bg)',
        padding: 12,
        zIndex: 100,
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: 3,
                background: extColor,
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                lineHeight: '1.4',
                flexShrink: 0,
              }}
            >
              {ext}
            </span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
            {state === 'playing' && (
              <span style={{ color: '#4ade80', fontSize: 11, alignSelf: 'center' }}>{'\u25CF'} Live</span>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '3px 12px',
                borderRadius: 4,
                border: '1px solid #555',
                background: 'transparent',
                color: '#ccc',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Close
            </button>
          </div>
        </div>

        {state === 'probing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 13, padding: '6px 0' }}>
            <span style={{ width: 14, height: 14, border: '2px solid #555', borderTopColor: '#999', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
            Probing stream\u2026
          </div>
        )}

        {warning && state !== 'probing' && (
          <div style={{ color: 'var(--warning-text)', fontSize: 12, marginBottom: 6, padding: '4px 8px', background: 'var(--warning-bg)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{'\u26A0'}</span>
            <span>{warning}</span>
          </div>
        )}

        {state === 'preparing' && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 13, padding: '6px 0' }}>
            <span style={{ width: 14, height: 14, border: '2px solid #555', borderTopColor: '#999', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
            Loading stream\u2026
          </div>
        )}

        {error && (
          <div style={{ color: '#f99', fontSize: 12, marginBottom: 6, padding: '4px 8px', background: 'rgba(255,0,0,0.1)', borderRadius: 4 }}>
            {error}
          </div>
        )}

        {isVideo ? (
          <video
            ref={videoRef}
            controls
            style={{ width: '100%', maxHeight: 400, borderRadius: 'var(--radius)', display: 'block' }}
          />
        ) : (
          <audio
            ref={audioRef}
            controls
            style={{ width: '100%', display: 'block' }}
          />
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
