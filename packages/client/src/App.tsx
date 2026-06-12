import { useState, useEffect, useCallback } from 'react'
import { api, getAuthToken, setAuthToken } from './api/client'
import { useTheme } from './theme'
import SearchBar from './components/SearchBar'
import SearchResults from './components/SearchResults'
import TorrentList from './components/TorrentList'
import Player from './components/Player'
import Login from './components/Login'
import trackIcon from './../public/trackIcon.svg'
import type { IndexerResult, TorrentStatus } from './types'
import { LangContext, translations, type Lang } from './i18n'

function useWideLayout(): boolean {
  const [wide, setWide] = useState(() => window.innerWidth > window.screen.width * 0.5)
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > window.screen.width * 0.5)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return wide
}

const btnIcon = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36,
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  fontSize: 18,
  transition: 'all .15s ease',
} as const

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const wide = useWideLayout()
  const [lang, setLang] = useState<Lang>('en')
  const [authenticated, setAuthenticated] = useState(!!getAuthToken())
  const [authLoading, setAuthLoading] = useState(true)
  const t = (k: string) => translations[lang][k] || k
  const [torrents, setTorrents] = useState<TorrentStatus[]>([])
  const [searchResults, setSearchResults] = useState<IndexerResult[]>([])
  const [selectedFile, setSelectedFile] = useState<{ infoHash: string; fileIndex: number; name: string } | null>(null)
  const [indexerConnected, setIndexerConnected] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    async function init() {
      const token = getAuthToken()
      if (token) {
        try {
          const res = await api.checkAuth()
          if (!res.authenticated) {
            setAuthToken(null)
            setAuthenticated(false)
          } else {
            setAuthenticated(true)
          }
        } catch {
          setAuthToken(null)
          setAuthenticated(false)
        }
      } else {
        setAuthenticated(false)
      }
      setAuthLoading(false)

      if (getAuthToken()) {
        api.health().then((h) => setIndexerConnected(h.indexer)).catch(() => {})
        loadTorrents()
      }
    }
    init()

    const interval = setInterval(() => {
      if (getAuthToken()) loadTorrents()
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadTorrents = useCallback(async () => {
    try {
      const data = await api.getTorrents()
      setTorrents(data)
    } catch {}
  }, [])

  const handleSearch = useCallback(async (query: string) => {
    setSearchError('')
    setSearching(true)
    setSearched(false)
    setSearchResults([])
    try {
      const results = await api.search(query)
      setSearchResults(results)
      setSearched(true)
    } catch (err) {
      setSearchError((err as Error).message)
    }
    setSearching(false)
  }, [])

  const handleAdd = useCallback(async (magnet: string) => {
    await api.addTorrent(magnet)
    await loadTorrents()
  }, [loadTorrents])

  const handleRemove = useCallback(async (infoHash: string) => {
    await api.removeTorrent(infoHash)
    setSelectedFile((prev) => prev?.infoHash === infoHash ? null : prev)
    await loadTorrents()
  }, [loadTorrents])

  const handlePlay = useCallback((infoHash: string, fileIndex: number, name: string) => {
    setSelectedFile({ infoHash, fileIndex, name })
  }, [])

  const handleLogout = useCallback(async () => {
    try { await api.logout() } catch {}
    setAuthToken(null)
    setAuthenticated(false)
    setTorrents([])
    setSearchResults([])
    setSelectedFile(null)
  }, [])

  const header = (
    <header style={{
      marginBottom: 28,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--primary), #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px var(--primary-glow)',
        }}>
          <img src={trackIcon} alt="" style={{ width: 22, height: 22, filter: 'brightness(0) invert(1)' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>
            TrackTorr
          </h1>
          <span style={{ fontSize: 12, color: indexerConnected ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
            {indexerConnected ? t('indexer.connected') : t('indexer.not_configured')}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a
          href="https://github.com/666komo/TrackTorr"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub"
          style={btnIcon}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>
        <button onClick={toggleTheme} title={theme === 'light' ? t('theme.dark') : t('theme.light')} style={btnIcon}>
          {theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
        </button>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="en">EN</option>
          <option value="cs">CS</option>
        </select>
        <button onClick={handleLogout} title={t('auth.logout')} style={btnIcon}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  )

  const searchSection = (
    <section style={{ animation: 'fadeIn .3s ease' }}>
      <SearchBar onSearch={handleSearch} searching={searching} />
      {searchError && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--danger-bg)',
          borderRadius: 'var(--radius)',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--danger)',
          border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
        }}>
          {searchError}
        </div>
      )}
      {searchResults.length > 0 && (
        <SearchResults results={searchResults} onAdd={handleAdd} />
      )}
      {!searching && searchResults.length === 0 && searchError === '' && (
        <div style={{
          color: 'var(--text-muted)',
          fontSize: 14,
          textAlign: 'center',
          marginTop: 48,
          lineHeight: 1.8,
        }}>
          {searched
            ? t('results.empty')
            : t('results.hint')
          }
        </div>
      )}
    </section>
  )

  const torrentSection = (
    <TorrentList
      wide={wide}
      torrents={torrents}
      onRemove={handleRemove}
      onPlay={handlePlay}
    />
  )

  if (authLoading) return null

  if (!authenticated) {
    return (
      <LangContext.Provider value={{ lang, setLang, t }}>
        <Login onLogin={() => {
          setAuthenticated(true)
          api.health().then((h) => setIndexerConnected(h.indexer)).catch(() => {})
          loadTorrents()
        }} />
      </LangContext.Provider>
    )
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
    <div style={{
      maxWidth: wide ? 1400 : 960,
      margin: '0 auto',
      padding: '24px 24px',
      minHeight: '100vh',
    }}>
      {header}
      {wide ? (
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {searchSection}
          </div>
          <div style={{ width: 380, flexShrink: 0 }}>
            {torrentSection}
          </div>
        </div>
      ) : (
        <>
          {searchSection}
          {torrentSection}
        </>
      )}
      {selectedFile && (
        <Player
          streamUrl={api.streamUrl(selectedFile.infoHash, selectedFile.fileIndex)}
          fileName={selectedFile.name}
          infoHash={selectedFile.infoHash}
          fileIndex={selectedFile.fileIndex}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
    </LangContext.Provider>
  )
}
