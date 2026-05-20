import type { IndexerConfig, IndexerResult } from '../types/index.js'

interface ProwlarrResult {
  title: string
  guid: string
  downloadUrl?: string
  infoUrl?: string
  size: number
  seeders: number
  leechers: number
  indexer: string
  publishDate: string
  categories?: { id: number; name: string }[]
  protocol?: string
}

interface JackettResult {
  Title: string
  Guid: string
  Link: string
  Size: number
  Seeders: number
  Peers: number
  MagnetUri?: string
  InfoHash?: string
  Tracker: string
  Category: string[]
  PublishDate: string
}

interface JackettResponse {
  Results: JackettResult[]
}

export class IndexerClient {
  private config: IndexerConfig

  constructor(config: IndexerConfig) {
    this.config = config
  }

  async search(query: string, _category?: string): Promise<IndexerResult[]> {
    try {
      return await this.searchProwlarr(query)
    } catch {
      try {
        return await this.searchJackett(query)
      } catch {
        throw new Error('Indexer search failed for both Prowlarr and Jackett')
      }
    }
  }

  private async searchProwlarr(query: string): Promise<IndexerResult[]> {
    const params = new URLSearchParams({ query })
    const res = await fetch(
      `${this.config.url}/api/v1/search?${params}`,
      {
        headers: {
          'X-Api-Key': this.config.apiKey,
        },
      }
    )

    if (!res.ok) {
      throw new Error(`Prowlarr request failed: ${res.status}`)
    }

    const data = (await res.json()) as ProwlarrResult[]

    return data.map((r) => ({
      title: r.title,
      guid: r.guid,
      link: r.downloadUrl || r.infoUrl || '',
      size: r.size,
      seeders: r.seeders,
      leechers: r.leechers,
      magnetUrl: r.downloadUrl,
      infoHash: undefined,
      indexer: r.indexer,
      category: r.categories?.map((c) => c.name).join(', ') || '',
      publishDate: r.publishDate,
    })).sort((a, b) => b.seeders - a.seeders)
  }

  private async searchJackett(query: string): Promise<IndexerResult[]> {
    const params = new URLSearchParams({ Query: query })
    const res = await fetch(
      `${this.config.url}/api/v2.0/indexers/all/results?${params}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      }
    )

    if (!res.ok) {
      throw new Error(`Jackett request failed: ${res.status}`)
    }

    const data = (await res.json()) as JackettResponse

    return data.Results.map((r) => ({
      title: r.Title,
      guid: r.Guid,
      link: r.Link,
      size: r.Size,
      seeders: r.Seeders,
      leechers: r.Peers - r.Seeders,
      magnetUrl: r.MagnetUri,
      infoHash: r.InfoHash,
      indexer: r.Tracker,
      category: r.Category.join(', '),
      publishDate: r.PublishDate,
    })).sort((a, b) => b.seeders - a.seeders)
  }
}
