import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api/client'
import type { ProbeResult } from '../types'

interface PlayerProps {
  streamUrl: string
  fileName: string
  infoHash: string
  fileIndex: number
  onClose: () => void
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

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function langLabel(lang: string): string {
  const names: Record<string, string> = {
    eng: 'English', spa: 'Spanish', fra: 'French', deu: 'German',
    jpn: 'Japanese', kor: 'Korean', chi: 'Chinese', rus: 'Russian',
    ara: 'Arabic', por: 'Portuguese', ita: 'Italian', nld: 'Dutch',
    pol: 'Polish', tur: 'Turkish', swe: 'Swedish', nor: 'Norwegian',
    dan: 'Danish', fin: 'Finnish', ces: 'Czech', hun: 'Hungarian',
    ron: 'Romanian', tha: 'Thai', vie: 'Vietnamese', heb: 'Hebrew',
    ind: 'Indonesian', msy: 'Malay',
  }
  return names[lang] || lang.toUpperCase()
}

export default function Player({ streamUrl, fileName, infoHash, fileIndex, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [state, setState] = useState<'probing' | 'preparing' | 'playing' | 'error'>('probing')
  const [expanded, setExpanded] = useState(true)
  const [paused, setPaused] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [showVol, setShowVol] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [useTranscode, setUseTranscode] = useState<boolean | null>(null)
  const [probeData, setProbeData] = useState<ProbeResult | null>(null)
  const [audioIndex, setAudioIndex] = useState<number | undefined>(undefined)
  const [subtitleIndex, setSubtitleIndex] = useState<number | undefined>(undefined)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const showWithTimeout = useCallback(() => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (!paused) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [paused])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const onMove = () => showWithTimeout()
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseenter', onMove)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseenter', onMove)
    }
  }, [showWithTimeout])

  useEffect(() => {
    if (paused) {
      setShowControls(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [paused])
  const volRef = useRef<HTMLInputElement>(null)
  const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']
  const isVideo = videoExts.some((ext) => fileName.toLowerCase().endsWith(ext))
  const ext = getExt(fileName)

  useEffect(() => {
    let cancelled = false
    setProbeData(null)
    setAudioIndex(undefined)
    setSubtitleIndex(undefined)
    api.probe(infoHash, fileIndex)
      .then((data) => {
        if (cancelled) return
        setProbeData(data)
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

  const streamOpts = useCallback(() => {
    if (!useTranscode) return { src: streamUrl, key: 'native' }
    return {
      src: api.transcodeUrl(infoHash, fileIndex, audioIndex),
      key: `transcode_${audioIndex ?? -1}_sub${subtitleIndex ?? -1}`,
    }
  }, [streamUrl, useTranscode, infoHash, fileIndex, audioIndex, subtitleIndex])

  useEffect(() => {
    if (useTranscode === null) return
    const el = isVideo ? videoRef.current : audioRef.current
    if (!el) return

    const prevTime = el.currentTime
    const { src } = streamOpts()
    setError('')
    setState('preparing')

    const onWaiting = () => setState('preparing')
    const onCanPlay = () => {
      if (prevTime > 0 && el.currentTime === 0) el.currentTime = prevTime
      setState('playing')
    }
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

    return () => {
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
    // key changes when audio/subtitle selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, isVideo, useTranscode, infoHash, fileIndex, streamOpts])

  useEffect(() => {
    const el = isVideo ? videoRef.current : audioRef.current
    if (!el) return
    const onPlay = () => setPaused(false)
    const onPause = () => setPaused(true)
    const onTime = () => setCurrentTime(el.currentTime)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTime)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTime)
    }
  }, [isVideo, state])

  // Save playback position periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const el = isVideo ? videoRef.current : audioRef.current
      if (el && el.currentTime > 0) {
        api.savePlaybackPosition(infoHash, Math.floor(el.currentTime)).catch(() => {})
      }
    }, 10000) // every 10 seconds
    return () => clearInterval(interval)
  }, [infoHash, isVideo])

  useEffect(() => {
    if (!isVideo || !useTranscode || subtitleIndex === undefined) return
    const video = videoRef.current
    if (!video) return

    const track = document.createElement('track')
    track.kind = 'subtitles'
    track.src = api.subtitleUrl(infoHash, fileIndex, subtitleIndex)
    track.label = 'Subtitles'
    track.srclang = 'und'
    track.default = true
    video.appendChild(track)

    const enable = () => { track.track.mode = 'showing' }
    track.addEventListener('load', enable)
    // Safari sometimes fires 'cuechange' before 'load'
    track.addEventListener('cuechange', enable)

    // Also poll — some browsers never fire 'load' for dynamic tracks
    const poll = setInterval(() => {
      if (track.track.mode !== 'showing') track.track.mode = 'showing'
    }, 200)
    setTimeout(() => clearInterval(poll), 5000)

    return () => {
      clearInterval(poll)
      track.removeEventListener('load', enable)
      track.removeEventListener('cuechange', enable)
      try { video.removeChild(track) } catch {}
    }
  }, [subtitleIndex, isVideo, useTranscode, infoHash, fileIndex])

  const togglePlay = useCallback(() => {
    const el = isVideo ? videoRef.current : audioRef.current
    if (!el) return
    if (el.paused) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [isVideo])

  const toggleFs = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  const handleVol = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    const el = isVideo ? videoRef.current : audioRef.current
    if (el) el.volume = v
  }, [isVideo])

  const extColor = extBadge[ext] || 'var(--text-muted)'
  const hasMultiAudio = probeData && probeData.audio.length > 1
  const hasSubtitles = probeData && probeData.subtitles.length > 0

  const controls = state === 'playing' || state === 'preparing' ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
        color: '#eee',
        fontSize: 13,
        opacity: showControls ? 1 : 0,
        transition: 'opacity .3s ease',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        onClick={togglePlay}
        title={paused ? 'Play' : 'Pause'}
        style={{
          background: 'none',
          border: 'none',
          color: '#eee',
          cursor: 'pointer',
          fontSize: 24,
          padding: '4px 10px',
          lineHeight: 1,
        }}
      >
        {paused ? '\u25B6' : '\u23F8'}
      </button>

      <span style={{ minWidth: 42, textAlign: 'center', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmt(currentTime)}</span>

      <span style={{ color: '#666', fontSize: 14 }}>|</span>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setShowVol((v) => !v)}
          title="Volume"
          style={{
            background: 'none',
            border: 'none',
            color: '#eee',
            cursor: 'pointer',
            fontSize: 22,
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >
          {volume === 0 ? '\u{1F507}' : volume < 0.5 ? '\u{1F509}' : '\u{1F50A}'}
        </button>
        {showVol && (
          <input
            ref={volRef}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVol}
            style={{ width: 80, position: 'absolute', left: '100%', top: '50%', margin: 0, transform: 'translateY(-50%)' }}
          />
        )}
      </div>

      {isVideo && (
        <button
          onClick={toggleFs}
          title="Fullscreen"
          style={{
            background: 'none',
            border: 'none',
            color: '#eee',
            cursor: 'pointer',
            fontSize: 22,
            padding: '4px 8px',
            lineHeight: 1,
            marginLeft: 'auto',
          }}
        >
          {'\u26F6'}
        </button>
      )}
    </div>
  ) : null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--player-bg)',
        zIndex: 100,
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
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
          {hasMultiAudio && useTranscode && (
            <select
              value={audioIndex ?? probeData!.audio[0].index}
              onChange={(e) => setAudioIndex(Number(e.target.value))}
              style={{
                padding: '2px 5px',
                borderRadius: 3,
                border: '1px solid #555',
                background: '#222',
                color: '#ccc',
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {probeData!.audio.map((a) => (
                <option key={a.index} value={a.index}>
                  {a.title || langLabel(a.language) || `Audio ${a.index}`} ({a.codec})
                </option>
              ))}
            </select>
          )}
          {hasSubtitles && useTranscode && (
            <select
              value={subtitleIndex ?? -1}
              onChange={(e) => setSubtitleIndex(Number(e.target.value) >= 0 ? Number(e.target.value) : undefined)}
              style={{
                padding: '2px 5px',
                borderRadius: 3,
                border: '1px solid #555',
                background: '#222',
                color: '#ccc',
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              <option value={-1}>No subtitles</option>
              {probeData!.subtitles.map((s) => (
                <option key={s.index} value={s.index}>
                  {s.title || langLabel(s.language) || `Sub ${s.index}`}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12, alignItems: 'center' }}>
          {state === 'playing' && (
            <span style={{ color: '#4ade80', fontSize: 11 }}>{'\u25CF'} Live</span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse' : 'Expand'}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #555',
              background: 'transparent',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: '1.4',
            }}
          >
            {expanded ? '\u25BC' : '\u25B2'}
          </button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 13, padding: '4px 16px 10px' }}>
          <span style={{ width: 14, height: 14, border: '2px solid #555', borderTopColor: '#999', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
          Probing stream\u2026
        </div>
      )}

      {warning && state !== 'probing' && (
        <div style={{ color: 'var(--warning-text)', fontSize: 12, margin: '0 16px 6px', padding: '4px 8px', background: 'var(--warning-bg)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{'\u26A0'}</span>
          <span>{warning}</span>
        </div>
      )}

      {state === 'preparing' && !error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 13, padding: '4px 16px 10px' }}>
          <span style={{ width: 14, height: 14, border: '2px solid #555', borderTopColor: '#999', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
          Loading stream\u2026
        </div>
      )}

      {error && (
        <div style={{ color: '#f99', fontSize: 12, margin: '0 16px 6px', padding: '4px 8px', background: 'rgba(255,0,0,0.1)', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {isVideo ? (
        <div
          style={{
            overflow: 'hidden',
            transition: 'max-height .3s ease',
            maxHeight: expanded ? '80vh' : 0,
          }}
        >
          <div ref={wrapperRef} className="fs-wrapper" style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxHeight: '80vh',
                display: 'block',
                objectFit: 'contain',
                background: '#000',
                cursor: 'pointer',
              }}
              onClick={togglePlay}
            >
            </video>
            {controls && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,.7))',
                  padding: '20px 12px 4px',
                  pointerEvents: 'auto',
                }}
              >
                {controls}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            overflow: 'hidden',
            transition: 'max-height .3s ease',
            maxHeight: expanded ? 60 : 0,
          }}
        >
          {controls}
          <div style={{ padding: '0 16px 10px' }}>
            <audio
              ref={audioRef}
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }

        /* fullscreen: fill entire screen, show custom controls */
        .fs-wrapper:-webkit-full-screen { width: 100%; height: 100%; background: #000 }
        .fs-wrapper:-webkit-full-screen video { max-height: 100vh !important; height: 100% }
        .fs-wrapper:fullscreen { width: 100%; height: 100%; background: #000 }
        .fs-wrapper:fullscreen video { max-height: 100vh !important; height: 100% }

        /* Subtitle styling */
        video::cue {
          color: #fff;
          background: transparent;
          text-shadow: 0 0 3px #000, 0 0 3px #000, 0 0 3px #000;
          font-size: 1.2em;
        }
        video::cue(b) { font-weight: bold }
        video::cue(i) { font-style: italic }
      `}</style>
    </div>
  )
}
