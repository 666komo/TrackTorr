declare module 'streamx' {
  import stream from 'stream'
  export class Readable {
    static from(iterator: AsyncIterable<unknown> | Iterable<unknown>): Readable
    pipe<T extends stream.Writable>(dest: T): T
    destroy(): void
    readonly destroyed: boolean
    resume(): this
    on(event: string, listener: (...args: any[]) => void): this
  }
}

declare module 'webtorrent' {
  interface TorrentFile {
    name: string
    path: string
    length: number
    downloaded: number
    progress: number
    createReadStream(opts?: { start?: number; end?: number }): NodeJS.ReadableStream
    select(priority?: number): void
    deselect(): void
  }

  interface Torrent {
    infoHash: string
    magnetURI: string
    name: string
    files: TorrentFile[]
    progress: number
    downloadSpeed: number
    uploadSpeed: number
    downloaded: number
    uploaded: number
    numPeers: number
    timeRemaining: number
    received: number
    destroy(): void
    pause(): void
    resume(): void
    on(event: 'ready', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: 'download', listener: (bytes: number) => void): this
    on(event: 'upload', listener: (bytes: number) => void): this
    on(event: 'done', listener: () => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  interface Instance {
    torrents: Torrent[]
    add(torrentId: string | Buffer, opts?: { path?: string; announce?: string[] }): Torrent
    get(infoHash: string): Torrent | undefined
    remove(infoHash: string): void
    destroy(): void
  }

  interface WebTorrentOpts {
    dht?: boolean
    tracker?: boolean
  }

  const WebTorrent: new (opts?: WebTorrentOpts) => Instance

  export default WebTorrent
}
