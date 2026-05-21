import { useState, useEffect, useCallback } from 'react'
import { api } from './api/client'
import { useTheme } from './theme'
import SearchBar from './components/SearchBar'
import SearchResults from './components/SearchResults'
import TorrentList from './components/TorrentList'
import Player from './components/Player'
import SettingsModal from './components/SettingsModal'
import trackIcon from './../public/trackIcon.svg'
import type { IndexerResult, TorrentStatus } from './types'

function useWideLayout(): boolean {
  const [wide, setWide] = useState(() => window.innerWidth > window.screen.width * 0.5)
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > window.screen.width * 0.5)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return wide
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const wide = useWideLayout()
  const [torrents, setTorrents] = useState<TorrentStatus[]>([])
  const [searchResults, setSearchResults] = useState<IndexerResult[]>([])
  const [selectedFile, setSelectedFile] = useState<{ infoHash: string; fileIndex: number; name: string } | null>(null)
  const [indexerConnected, setIndexerConnected] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    api.health().then((h) => setIndexerConnected(h.indexer)).catch(() => {})
    loadTorrents()
    const interval = setInterval(loadTorrents, 3000)
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

  const header = (
    <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 22 }}>
          <img src={trackIcon} alt="" style={{ width: 28, height: 28 }} />
          TrackTorr
        </h1>
        <span style={{ fontSize: 12, color: indexerConnected ? 'var(--success)' : 'var(--text-muted)' }}>
          indexer {indexerConnected ? 'connected' : 'not configured'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <a
          href="https://github.com/666komo/TrackTorr"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-light)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 18,
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-light)',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 18,
          }}
        >
          {theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-light)',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 18,
          }}
        >
          &#9881;
        </button>
      </div>
    </header>
  )

  const searchSection = (
    <>
      <SearchBar onSearch={handleSearch} searching={searching} />

      {searchError && (
        <div style={{ padding: '10px 14px', background: 'var(--danger-bg, #fee)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 14, color: 'var(--danger)' }}>
          {searchError}
        </div>
      )}

      {searchResults.length > 0 && (
        <SearchResults results={searchResults} onAdd={handleAdd} />
      )}

      {!searching && searchResults.length === 0 && searchError === '' && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginTop: 32, lineHeight: 1.6 }}>
          {searched ? 'No results found.' : 'Search for torrents using the bar above.'}
        </div>
      )}
    </>
  )

  const torrentSection = (
    <TorrentList
      torrents={torrents}
      onRemove={handleRemove}
      onPlay={handlePlay}
    />
  )

  return (
    <div style={{ maxWidth: wide ? 1400 : 960, margin: '0 auto', padding: '20px 16px' }}>
      {header}

      {wide ? (
        <div style={{ display: 'flex', gap: 24 }}>
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

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
