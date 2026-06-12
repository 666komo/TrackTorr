import type { AppConfig, IndexerResult, TorrentStatus, ProbeResult } from '../types'

const BASE = '/api'

let authToken: string | null = localStorage.getItem('auth_token')

function authHeaders(): Record<string, string> {
  if (!authToken) return {}
  return { Authorization: `Bearer ${authToken}` }
}

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) localStorage.setItem('auth_token', token)
  else localStorage.removeItem('auth_token')
}

export function getAuthToken() {
  return authToken
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const fullUrl = `${BASE}${url}`
  const headers = new Headers(init?.headers)
  const ah = authHeaders()
  if (ah.Authorization) headers.set('Authorization', ah.Authorization)
  const res = await fetch(fullUrl, { ...init, headers })
  const text = await res.text()
  if (!res.ok) {
    let msg: string
    try {
      const json = JSON.parse(text)
      msg = json.error || res.statusText
    } catch {
      msg = `Server returned ${res.status}: ${text.slice(0, 100)}`
    }
    if (res.status === 401) setAuthToken(null)
    throw new Error(msg)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Expected JSON but got HTML (${res.status}): ${text.slice(0, 100)}`)
  }
}

export const api = {
  health: () => fetchJson<{ status: string; indexer: boolean }>('/health'),

  login: (username: string, password: string) =>
    fetchJson<{ token: string }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    fetchJson<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  checkAuth: () =>
    fetchJson<{ authenticated: boolean }>('/auth/check'),

  search: (query: string, category?: string) => {
    const params = new URLSearchParams({ q: query })
    if (category) params.set('category', category)
    return fetchJson<IndexerResult[]>(`/search?${params}`)
  },

  getTorrents: () => fetchJson<TorrentStatus[]>('/torrents'),

  getTorrent: (infoHash: string) =>
    fetchJson<TorrentStatus>(`/torrents/${infoHash}`),

  addTorrent: (magnet: string) =>
    fetchJson<{ infoHash: string; name: string }>('/torrents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnet }),
    }),

  addByInfoHash: (infoHash: string) =>
    fetchJson<{ infoHash: string; name: string }>('/torrents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ infoHash }),
    }),

  removeTorrent: (infoHash: string) =>
    fetchJson<{ success: boolean }>(`/torrents/${infoHash}`, { method: 'DELETE' }),

  selectFiles: (infoHash: string, files: number[]) =>
    fetchJson<{ success: boolean }>(`/torrents/${infoHash}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    }),

  deselectFiles: (infoHash: string, files: number[]) =>
    fetchJson<{ success: boolean }>(`/torrents/${infoHash}/deselect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    }),

  getConfig: () => fetchJson<AppConfig>('/config'),

  saveConfig: (config: AppConfig) =>
    fetchJson<{ success: boolean; message: string }>('/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),

  streamUrl: (infoHash: string, fileIndex: number) =>
    `${BASE}/stream/${infoHash}/${fileIndex}`,

  transcodeUrl: (infoHash: string, fileIndex: number, audioIndex?: number, subtitleIndex?: number) => {
    let url = `${BASE}/stream/transcode/${infoHash}/${fileIndex}`
    const params: string[] = []
    if (audioIndex !== undefined) params.push(`audio_index=${audioIndex}`)
    if (subtitleIndex !== undefined) params.push(`subtitle_index=${subtitleIndex}`)
    if (params.length > 0) url += '?' + params.join('&')
    return url
  },

  subtitleUrl: (infoHash: string, fileIndex: number, subtitleIndex: number) =>
    `${BASE}/stream/subtitle/${infoHash}/${fileIndex}?subtitle_index=${subtitleIndex}`,

  probeUrl: (infoHash: string, fileIndex: number) =>
    `${BASE}/stream/probe/${infoHash}/${fileIndex}`,

  probe: (infoHash: string, fileIndex: number) =>
    fetchJson<ProbeResult>(`/stream/probe/${infoHash}/${fileIndex}`),

  savePlaybackPosition: (infoHash: string, position: number) =>
    fetchJson<{ ok: boolean }>(`/stream/playback/${infoHash}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position }),
    }),

  flushCache: () =>
    fetchJson<{ success: boolean; message: string }>('/maintenance/flush-cache', { method: 'POST' }),

  flushDownloads: () =>
    fetchJson<{ success: boolean; message: string }>('/maintenance/flush-downloads', { method: 'POST' }),
}
