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

export default function Player({ streamUrl, fileName, infoHash, fileIndex, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [buffering, setBuffering] = useState(true)
  const [useTranscode, setUseTranscode] = useState<boolean | null>(null)
  const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']
  const isVideo = videoExts.some((ext) => fileName.toLowerCase().endsWith(ext))

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
          console.warn('[probe]', data.error)
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
    setBuffering(true)

    const onWaiting = () => setBuffering(true)
    const onCanPlay = () => { setBuffering(false); setError('') }
    const onError = () => {
      const ec = (el as HTMLMediaElement).error
      if (ec) {
        const codes = ['', 'MEDIA_ERR_ABORTED', 'MEDIA_ERR_NETWORK', 'MEDIA_ERR_DECODE', 'MEDIA_ERR_SRC_NOT_SUPPORTED']
        setError(`Playback error: ${codes[ec.code] || ec.code}${ec.message ? ' (' + ec.message + ')' : ''}`)
      } else {
        setError('Failed to load stream')
      }
    }

    el.addEventListener('waiting', onWaiting)
    el.addEventListener('canplay', onCanPlay)
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
      el.removeEventListener('error', onError)
      el.src = ''
    }
  }, [streamUrl, isVideo, useTranscode, infoHash, fileIndex])

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>
            {fileName}
          </span>
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
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>

        {useTranscode === null && (
          <div style={{ color: '#999', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>
            Probing stream\u2026
          </div>
        )}

        {warning && useTranscode !== null && (
          <div style={{ color: 'var(--warning-text)', fontSize: 12, textAlign: 'center', marginBottom: 4, padding: '4px 8px', background: 'var(--warning-bg)', borderRadius: 4 }}>
            {'\u26A0'} {warning}
          </div>
        )}

        {useTranscode !== null && buffering && !error && (
          <div style={{ color: '#999', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>
            Buffering\u2026
          </div>
        )}

        {error && (
          <div style={{ color: '#f99', fontSize: 12, textAlign: 'center', marginBottom: 4, padding: '4px 8px', background: 'rgba(255,0,0,0.1)', borderRadius: 4 }}>
            {error}
          </div>
        )}

        {isVideo ? (
          <video
            ref={videoRef}
            controls
            style={{ width: '100%', maxHeight: 400, borderRadius: 'var(--radius)' }}
          />
        ) : (
          <audio
            ref={audioRef}
            controls
            style={{ width: '100%' }}
          />
        )}
      </div>
    </div>
  )
}
