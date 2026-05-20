import type { AppConfig, IndexerResult, TorrentStatus } from '../types'

const BASE = '/api'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const fullUrl = `${BASE}${url}`
  const res = await fetch(fullUrl, init)
  const text = await res.text()
  if (!res.ok) {
    let msg: string
    try {
      const json = JSON.parse(text)
      msg = json.error || res.statusText
    } catch {
      msg = `Server returned ${res.status}: ${text.slice(0, 100)}`
    }
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

  getConfig: () => fetchJson<AppConfig>('/config'),

  saveConfig: (config: AppConfig) =>
    fetchJson<{ success: boolean; message: string }>('/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),

  streamUrl: (infoHash: string, fileIndex: number) =>
    `${BASE}/stream/${infoHash}/${fileIndex}`,

  transcodeUrl: (infoHash: string, fileIndex: number) =>
    `${BASE}/stream/transcode/${infoHash}/${fileIndex}`,

  probeUrl: (infoHash: string, fileIndex: number) =>
    `${BASE}/stream/probe/${infoHash}/${fileIndex}`,
}
