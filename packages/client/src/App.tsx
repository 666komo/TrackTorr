import { useState, useEffect, useCallback } from 'react'
import { api } from './api/client'
import SearchBar from './components/SearchBar'
import SearchResults from './components/SearchResults'
import TorrentList from './components/TorrentList'
import Player from './components/Player'
import SettingsModal from './components/SettingsModal'
import trackIcon from './../public/trackIcon.svg'
import type { IndexerResult, TorrentStatus } from './types'

export default function App() {
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

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={trackIcon} alt="" style={{ width: 28, height: 28 }} />
            TrackTorr
          </h1>
          <span style={{ fontSize: 12, color: indexerConnected ? 'green' : '#999' }}>
            indexer {indexerConnected ? 'connected' : 'not configured'}
          </span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #ccc',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          &#9881;
        </button>
      </header>

      <SearchBar onSearch={handleSearch} searching={searching} />

      {searchError && (
        <div style={{ padding: 10, background: '#fee', borderRadius: 6, marginBottom: 16, fontSize: 14, color: '#c00' }}>
          {searchError}
        </div>
      )}

      {searchResults.length > 0 && (
        <SearchResults results={searchResults} onAdd={handleAdd} />
      )}

      {!searching && searchResults.length === 0 && searchError === '' && (
        <div style={{ color: '#999', fontSize: 14, textAlign: 'center', marginTop: 24 }}>
          {searched ? 'No results found.' : 'Search for torrents using the bar above.'}
        </div>
      )}

      <TorrentList
        torrents={torrents}
        onRemove={handleRemove}
        onPlay={handlePlay}
      />

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
