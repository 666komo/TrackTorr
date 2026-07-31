import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api/client'
import type { ProbeResult } from '../types'
import { useLang } from '../i18n'

interface PlayerProps {
  streamUrl: string
  fileName: string
  infoHash: string
  fileIndex: number
  onClose: () => void
}

const extBadge: Record<string, string> = {
  mp4: '#46ebeb', mkv: '#7C4DFF', avi: '#FCEE0C',
  mov: '#00ff88', webm: '#FB0A26', m4v: '#46ebeb',
  mp3: '#FFD600', flac: '#7C4DFF', wav: '#00ff88', ogg: '#FCEE0C',
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

const btn = {
  background: 'none',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  opacity: 0.85,
  transition: 'opacity .15s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

export default function Player({ streamUrl, fileName, infoHash, fileIndex, onClose }: PlayerProps) {
  const { t } = useLang()
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [state, setState] = useState<'probing' | 'preparing' | 'playing' | 'error'>('probing')
  const [expanded, setExpanded] = useState(true)
  const [paused, setPaused] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
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

  const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']
  const audioExts = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.mka']
  const isVideo = videoExts.some((ext) => fileName.toLowerCase().endsWith(ext))
  const isAudio = audioExts.some((ext) => fileName.toLowerCase().endsWith(ext))
  const ext = getExt(fileName)

  useEffect(() => {
    let cancelled = false
    setProbeData(null)
    setAudioIndex(undefined)
    setSubtitleIndex(undefined)

    if (isAudio) {
      setUseTranscode(false)
      return
    }

    api.probe(infoHash, fileIndex)
      .then((data) => {
        if (cancelled) return
        const safeData = {
          ...data,
          audio: data.audio || [],
          subtitles: data.subtitles || [],
          streams: data.streams || [],
        }
        setProbeData(safeData)
        if (safeData.has_eac3) {
          setWarning('Unsupported audio codec \u2014 transcoding for browser playback.')
        }
        if (safeData.supported) {
          setUseTranscode(false)
        } else if (data.error) {
          const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
          const nativePlayable = ext === '.mp4' || ext === '.m4v' || ext === '.webm'
          setUseTranscode(!nativePlayable)
        } else {
          setUseTranscode(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
          setUseTranscode(ext !== '.mp4' && ext !== '.m4v' && ext !== '.webm')
        }
      })
    return () => { cancelled = true }
  }, [infoHash, fileIndex, isAudio])

  const streamOpts = useCallback(() => {
    if (!useTranscode) return { src: streamUrl, key: 'native' }
    return {
      src: api.transcodeUrl(infoHash, fileIndex, audioIndex, subtitleIndex),
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
    const onLoadedMeta = () => {
      setDuration(el.duration)
    }

    el.addEventListener('waiting', onWaiting)
    el.addEventListener('canplay', onCanPlay)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    el.addEventListener('loadedmetadata', onLoadedMeta)

    el.src = src
    el.load()

    return () => {
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
      el.removeEventListener('loadedmetadata', onLoadedMeta)
    }
  }, [streamUrl, isVideo, useTranscode, infoHash, fileIndex, streamOpts])

  useEffect(() => {
    const el = isVideo ? videoRef.current : audioRef.current
    if (!el) return
    const onPlay = () => setPaused(false)
    const onPause = () => setPaused(true)
    const onTime = () => setCurrentTime(el.currentTime)
    const onLoadedMeta = () => setDuration(el.duration)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoadedMeta)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoadedMeta)
    }
  }, [isVideo, state])

  // Save playback position periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const el = isVideo ? videoRef.current : audioRef.current
      if (el && el.currentTime > 0) {
        api.savePlaybackPosition(infoHash, Math.floor(el.currentTime)).catch(() => {})
      }
    }, 10000)
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
    track.addEventListener('cuechange', enable)
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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const el = isVideo ? videoRef.current : audioRef.current
      if (!el) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (el.paused) { el.play().catch(() => {}) } else { el.pause() }
          break
        case 'ArrowLeft':
          e.preventDefault()
          el.currentTime = Math.max(0, el.currentTime - (e.shiftKey ? 30 : 10))
          break
        case 'ArrowRight':
          e.preventDefault()
          el.currentTime = Math.min(el.duration || 0, el.currentTime + (e.shiftKey ? 30 : 10))
          break
        case 'f':
        case 'F':
          if (!isVideo) break
          e.preventDefault()
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            wrapperRef.current?.requestFullscreen()
          }
          break
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isVideo])

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

  const extColor = extBadge[ext] || 'var(--text-muted)'
  const hasMultiAudio = probeData && (probeData.audio || []).length > 1
  const hasSubtitles = probeData && (probeData.subtitles || []).length > 0
  return (
    <div
      style={{
        background: 'var(--player-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 0 30px rgba(70,235,235,0.2)',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent, var(--primary), var(--secondary), transparent)',
        animation: 'dataStream 3s linear infinite',
      }} />
      {/* Status bar */}
      <div style={{
        padding: '8px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          {ext && (
            <span style={{
              padding: '3px 8px', borderRadius: 'var(--radius)',
              background: extColor, color: '#000',
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', lineHeight: '1.4', flexShrink: 0,
              boxShadow: `0 0 8px ${extColor}`,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: '1px',
            }}>
              {ext}
            </span>
          )}
          <span style={{
            color: 'var(--text)', fontSize: 14, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {fileName}
          </span>
          {state === 'probing' && (
            <span style={{
              width: 14, height: 14,
              border: '2px solid var(--primary)',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin .6s linear infinite', flexShrink: 0,
              boxShadow: '0 0 8px var(--primary)',
            }} />
          )}
          {state === 'playing' && (
            <span style={{
              color: 'var(--success)', fontSize: 11, fontWeight: 700, flexShrink: 0,
              textShadow: '0 0 6px var(--success)',
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: '1px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'var(--success)',
                boxShadow: '0 0 8px var(--success)',
                animation: 'neonPulse 2s ease-in-out infinite',
              }} />
              {t('player.live')}
            </span>
          )}
          {hasMultiAudio && useTranscode && (
            <select
              value={audioIndex ?? probeData!.audio[0].index}
              onChange={(e) => setAudioIndex(Number(e.target.value))}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius)',
                border: '1px solid var(--primary)',
                background: 'var(--bg-card)',
                color: 'var(--primary)', fontSize: 11, flexShrink: 0,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = 'var(--glow-cyan)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none'
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
                padding: '4px 10px', borderRadius: 'var(--radius)',
                border: '1px solid var(--secondary)',
                background: 'var(--bg-card)',
                color: 'var(--secondary)', fontSize: 11, flexShrink: 0,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = 'var(--glow-violet)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <option value={-1}>{t('player.no_subtitles')}</option>
              {probeData!.subtitles.map((s) => (
                <option key={s.index} value={s.index}>
                  {s.title || langLabel(s.language) || `Sub ${s.index}`}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <button onClick={() => setExpanded((v) => !v)} title={expanded ? t('player.collapse') : t('player.expand')} style={{
            ...btn, padding: '6px 10px', fontSize: 16, opacity: 0.8,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--primary)',
            transition: 'all .2s ease',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)'
              e.currentTarget.style.boxShadow = 'var(--glow-cyan)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {expanded ? '\u25BC' : '\u25B2'}
          </button>
          <button onClick={onClose} title={t('player.close_player')} style={{
            ...btn, padding: '6px 12px', fontSize: 12, fontWeight: 700, opacity: 0.8,
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)',
            color: 'var(--danger)',
            background: 'transparent',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontFamily: "'Orbitron', sans-serif",
            transition: 'all .2s ease',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--glow-violet)'
              e.currentTarget.style.background = 'var(--danger-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {t('player.close')}
          </button>
        </div>
      </div>

      {warning && state !== 'probing' && (
        <div style={{
          color: 'var(--warning)', fontSize: 12, margin: '0 18px 8px',
          padding: '8px 12px', background: 'var(--warning-bg)',
          borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--warning)',
          boxShadow: '0 0 10px rgba(255,170,0,0.3)',
        }}>
          <span>{'\u26A0'}</span>
          <span>{warning}</span>
        </div>
      )}

      {state === 'preparing' && !error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          color: 'var(--primary)', fontSize: 13, padding: '6px 18px 12px',
          fontWeight: 600,
        }}>
          <span style={{
            width: 16, height: 16,
            border: '2px solid var(--primary)',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin .6s linear infinite',
            boxShadow: '0 0 8px var(--primary)',
          }} />
          {t('player.loading')}
        </div>
      )}

      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 12, margin: '0 18px 8px',
          padding: '8px 12px', background: 'var(--danger-bg)',
          borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid var(--danger)',
          boxShadow: '0 0 10px rgba(255,0,102,0.3)',
        }}>
          <span>{error}</span>
          <button
            onClick={() => {
              setError('')
              setState('probing')
              setUseTranscode(null)
            }}
            style={{
              padding: '4px 12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--danger)',
              background: 'transparent', color: 'var(--danger)',
              cursor: 'pointer', fontSize: 11, flexShrink: 0,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all .2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--glow-violet)'
              e.currentTarget.style.background = 'var(--danger-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {isVideo && (
        <div style={{
          overflow: 'hidden',
          transition: 'max-height .3s ease',
          maxHeight: expanded ? '50vh' : 0,
        }}>
          <div ref={wrapperRef} className="fs-wrapper" style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              style={{
                width: '100%', maxHeight: '50vh',
                display: 'block', objectFit: 'contain',
                background: '#000', cursor: 'pointer',
              }}
              onClick={togglePlay}
            />
            {/* Overlay controls */}
            {state !== 'probing' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                  padding: '32px 14px 10px',
                  opacity: showControls ? 1 : 0,
                  transition: 'opacity .3s ease',
                  pointerEvents: showControls ? 'auto' : 'none',
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)' }}>
                  <button onClick={togglePlay} title={paused ? 'Play' : 'Pause'} style={{
                    ...btn, fontSize: 22, padding: '4px 8px', opacity: 0.9,
                    color: 'var(--primary)',
                    textShadow: '0 0 8px var(--primary)',
                  }}>
                    {paused ? '\u25B6' : '\u23F8'}
                  </button>
                  <span style={{
                    fontSize: 12, fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-secondary)', minWidth: 80,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {fmt(currentTime)} / {fmt(duration)}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={toggleFs} title="Fullscreen" style={{
                    ...btn, fontSize: 18, padding: '4px 8px',
                    color: 'var(--primary)',
                    textShadow: '0 0 8px var(--primary)',
                  }}>
                    {'\u26F6'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isVideo && expanded && (
        <>
          <div style={{ padding: '0 14px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={togglePlay} title={paused ? 'Play' : 'Pause'} style={{
              ...btn, fontSize: 20, color: 'var(--primary)',
              textShadow: '0 0 8px var(--primary)',
            }}>
              {paused ? '\u25B6' : '\u23F8'}
            </button>
            <span style={{
              fontSize: 12, color: 'var(--text-secondary)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>
          <div style={{ padding: '0 14px 8px' }}>
            <audio ref={audioRef} style={{ width: '100%', display: 'block' }} />
          </div>
        </>
      )}

      <style>{`
        .fs-wrapper:-webkit-full-screen { width: 100%; height: 100%; background: #000 }
        .fs-wrapper:-webkit-full-screen video { max-height: 100vh !important; height: 100% }
        .fs-wrapper:fullscreen { width: 100%; height: 100%; background: #000 }
        .fs-wrapper:fullscreen video { max-height: 100vh !important; height: 100% }
        video::-webkit-media-controls { display: none !important }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--primary);
          border: 2px solid #000;
          cursor: pointer;
          box-shadow: 0 0 8px var(--primary);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--primary);
          border: 2px solid #000;
          cursor: pointer;
          box-shadow: 0 0 8px var(--primary);
        }
        video::cue { color: #fff; background: transparent; text-shadow: 0 0 3px #000, 0 0 3px #000, 0 0 3px #000; font-size: 1.2em; }
        video::cue(b) { font-weight: bold }
        video::cue(i) { font-style: italic }
      `}</style>
    </div>
  )
}
