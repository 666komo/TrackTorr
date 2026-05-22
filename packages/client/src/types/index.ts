export interface IndexerResult {
  title: string
  guid: string
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
  downloaded: number
  streamable: boolean
  selected: boolean
}

export interface ProbeStream {
  index: number
  codec_type: string
  codec_name: string
  tags?: { language?: string; title?: string }
}

export interface ProbeAudioStream {
  index: number
  codec: string
  language: string
  title?: string
}

export interface ProbeSubtitleStream {
  index: number
  codec: string
  language: string
  title?: string
}

export interface ProbeResult {
  streams: ProbeStream[]
  audio: ProbeAudioStream[]
  subtitles: ProbeSubtitleStream[]
  has_eac3: boolean
  supported: boolean
  error?: string
}

export interface AppConfig {
  port: number
  host: string
  indexerUrl: string
  indexerApiKey: string
  downloadDir: string
}
