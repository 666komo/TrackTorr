export interface IndexerConfig {
  url: string
  apiKey: string
}

export interface IndexerResult {
  title: string
  guid: string
  link: string
  size: number
  seeders: number
  leechers: number
  magnetUrl?: string
  infoHash?: string
  indexer: string
  category?: string
  publishDate: string
}

export interface TorrentStatus {
  infoHash: string
  name: string
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  downloaded: number
  uploaded: number
  peers: number
  timeRemaining: number | null
  status: 'downloading' | 'streaming' | 'completed' | 'paused' | 'error'
  files: TorrentFile[]
}

export interface TorrentFile {
  name: string
  path: string
  length: number
  index: number
  streamUrl?: string
  selected?: boolean
}

export interface AddTorrentRequest {
  magnet?: string
  infoHash?: string
  file?: string
}

export interface SelectFilesRequest {
  files: number[]
}

export interface SearchQuery {
  query: string
  indexer?: string
  category?: string
  limit?: number
}

export interface ServerConfig {
  port: number
  host: string
  indexer?: IndexerConfig
  downloadDir: string
  username?: string
  password?: string
}
