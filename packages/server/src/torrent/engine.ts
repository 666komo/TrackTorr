import WebTorrent from 'webtorrent'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'streamx'
import type { TorrentStatus } from '../types/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STREAMER_BIN = path.resolve(__dirname, '..', '..', '..', '..', 'dist', 'streamer')

type WTInstance = InstanceType<typeof WebTorrent>
const BLOCK_SIZE = 1 << 14

export class TorrentEngine {
  private client: WTInstance
  private downloadDir: string
  private preloads = new Map<string, { stream: import('streamx').Readable; timeout: ReturnType<typeof setTimeout> }>()
  private goPort: number | null = null
  private goProcess: any = null
  private goReady = false
  private torrentSources = new Map<string, { type: 'magnet' | 'torrent' | 'infohash'; data: string }>()

  constructor(downloadDir: string) {
    this.downloadDir = downloadDir
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true })
    }
    this.client = new WebTorrent({ dht: true, tracker: true })
    this.startGoStreamer()
  }

  private startGoStreamer(): void {
    if (!fs.existsSync(STREAMER_BIN)) {
      console.log('[go] streamer binary not found at', STREAMER_BIN)
      return
    }
    const proc = spawn(STREAMER_BIN, ['--dir', this.downloadDir], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.goProcess = proc

    let buf = ''
    proc.stdout!.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      while (true) {
        const idx = buf.indexOf('\n')
        if (idx === -1) break
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line) continue
        try {
          const msg = JSON.parse(line)
          if (msg.type === 'ready') {
            this.goPort = msg.port
            this.goReady = true
            console.log('[go] streamer ready on port', msg.port)
          } else if (msg.type === 'dropped') {
            const hash = msg.infoHash as string
            console.log('[go] dropped', hash.slice(0, 12))
            this.torrentSources.delete(hash)
            const t = this.client.get(hash)
            if (t) this.client.remove(hash)
          }
        } catch { /* ignore partial json */ }
      }
    })

    proc.stderr!.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log('[go]', line)
    })

    proc.on('exit', (code: number) => {
      console.log('[go] streamer exited with code', code)
      this.goReady = false
      this.goPort = null
      this.goProcess = null
    })

    proc.on('error', (err: Error) => {
      console.log('[go] streamer error:', err.message)
      this.goReady = false
      this.goPort = null
      this.goProcess = null
    })
  }

  get goAvailable(): boolean {
    return this.goReady && this.goPort !== null
  }

  get goStreamerPort(): number | null {
    return this.goPort
  }

  getTorrentSource(infoHash: string): { type: 'magnet' | 'torrent' | 'infohash'; data: string } | undefined {
    return this.torrentSources.get(infoHash)
  }

  sendGoAdd(infoHash: string): void {
    const src = this.torrentSources.get(infoHash)
    if (!src) return
    if (src.type === 'magnet') {
      this.sendGoCommand({ cmd: 'add_magnet', uri: src.data })
    } else if (src.type === 'torrent') {
      this.sendGoCommand({ cmd: 'add_torrent', data: src.data, type: 'torrent' })
    } else if (src.type === 'infohash') {
      this.sendGoCommand({ cmd: 'add_magnet', uri: `magnet:?xt=urn:btih:${src.data}` })
    }
  }

  private sendGoCommand(cmd: object): void {
    if (!this.goProcess || !this.goProcess.stdin) return
    try {
      this.goProcess.stdin.write(JSON.stringify(cmd) + '\n')
    } catch {
      // ignore if pipe is closed
    }
  }

  addMagnet(magnet: string): Promise<{ infoHash: string; name: string }> {
    this.sendGoCommand({ cmd: 'add_magnet', uri: magnet })
    return new Promise((resolve, reject) => {
      const torrent = this.client.add(magnet, { path: this.downloadDir })
      torrent.on('ready', () => {
        this.torrentSources.set(torrent.infoHash, { type: 'magnet', data: magnet })
        resolve({ infoHash: torrent.infoHash, name: torrent.name })
      })
      torrent.on('error', (err: Error) => reject(err))
    })
  }

  addInfoHash(infoHash: string): Promise<{ infoHash: string; name: string }> {
    const magnet = `magnet:?xt=urn:btih:${infoHash}`
    this.sendGoCommand({ cmd: 'add_magnet', uri: magnet })
    this.torrentSources.set(infoHash, { type: 'infohash', data: infoHash })
    return new Promise((resolve, reject) => {
      const torrent = this.client.add(infoHash, { path: this.downloadDir })
      torrent.on('ready', () => resolve({ infoHash: torrent.infoHash, name: torrent.name }))
      torrent.on('error', (err: Error) => reject(err))
    })
  }

  addTorrentFile(buffer: Buffer): Promise<{ infoHash: string; name: string }> {
    const b64 = buffer.toString('base64')
    this.sendGoCommand({ cmd: 'add_torrent', data: b64, type: 'torrent' })
    return new Promise((resolve, reject) => {
      const torrent = this.client.add(buffer, { path: this.downloadDir })
      torrent.on('ready', () => {
        this.torrentSources.set(torrent.infoHash, { type: 'torrent', data: b64 })
        resolve({ infoHash: torrent.infoHash, name: torrent.name })
      })
      torrent.on('error', (err: Error) => reject(err))
    })
  }

  remove(infoHash: string): void {
    this.stopPreload(infoHash)
    this.sendGoCommand({ cmd: 'remove', infoHash })
    this.torrentSources.delete(infoHash)
    const torrent = this.client.get(infoHash)
    if (torrent) {
      this.client.remove(infoHash)
    }
  }

  removeAll(): void {
    const hashes = this.client.torrents.map((t) => t.infoHash)
    for (const h of hashes) {
      this.stopPreload(h)
      this.sendGoCommand({ cmd: 'remove', infoHash: h })
      this.torrentSources.delete(h)
      this.client.remove(h)
    }
  }

  getTorrent(infoHash: string): { infoHash: string; name: string; files: { name: string; path: string; length: number; index: number }[] } | undefined {
    const torrent = this.client.torrents.find(
      (t) => t.infoHash === infoHash || t.infoHash.toLowerCase() === infoHash.toLowerCase()
    )
    if (!torrent) return undefined
    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      files: torrent.files.map((f, i) => ({
        name: f.name,
        path: f.path,
        length: f.length,
        index: i,
      })),
    }
  }

  getAllTorrents(): TorrentStatus[] {
    return this.client.torrents.map((t) => this.mapTorrentStatus(t))
  }

  getTorrentStatus(infoHash: string): TorrentStatus | undefined {
    const torrent = this.getTorrent(infoHash)
    if (!torrent) return undefined
    return this.getTorrentStatusByInfoHash(infoHash)
  }

  private getRawTorrent(infoHash: string) {
    return this.client.torrents.find(
      (t) => t.infoHash === infoHash || t.infoHash.toLowerCase() === infoHash.toLowerCase()
    )
  }

  private mapTorrentStatus(torrent: ReturnType<WTInstance['add']>): TorrentStatus {
    const status: TorrentStatus = {
      infoHash: torrent.infoHash,
      name: torrent.name,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      downloaded: torrent.downloaded,
      uploaded: torrent.uploaded,
      peers: torrent.numPeers,
      timeRemaining: torrent.timeRemaining,
      status: 'downloading',
      files: [],
    }

    if (torrent.progress >= 1) {
      status.status = 'completed'
    } else if (torrent.downloadSpeed > 0) {
      status.status = 'downloading'
    }

    status.files = torrent.files.map((f, i) => ({
      name: f.name,
      path: f.path,
      length: f.length,
      index: i,
    }))

    return status
  }

  private getTorrentStatusByInfoHash(infoHash: string): TorrentStatus | undefined {
    const torrent = this.getRawTorrent(infoHash)
    if (!torrent) return undefined
    return this.mapTorrentStatus(torrent)
  }

  selectForStream(infoHash: string, fileIndex: number): void {
    const torrent = this.getRawTorrent(infoHash)
    if (!torrent) return
    const file = torrent.files[fileIndex]
    if (!file) return
    try {
      file.select(10)
      const raw = torrent as unknown as RawTorrent
      if (raw.pieces && raw.pieces.length > 0) {
        // Also select last pieces at high priority for metadata (moov, cues)
        const fileOffset = (file as unknown as { offset: number }).offset
        const endPiece = Math.floor((fileOffset + file.length - 1) / raw.pieceLength)
        const startLast = Math.max(0, endPiece - 10)
        raw.select(startLast, endPiece, 10)
        raw.critical(startLast, endPiece)
        this.startEndPreload(infoHash, fileIndex, file, raw)
      }
    } catch {
      // ignore
    }
  }

  private startEndPreload(infoHash: string, fileIndex: number, file: any, raw: RawTorrent): void {
    const key = `${infoHash}/${fileIndex}`
    if (this.preloads.has(key)) return
    const fileOffset = file.offset ?? 0
    const endPiece = Math.floor((fileOffset + file.length - 1) / raw.pieceLength)
    if (raw.bitfield && raw.bitfield.get(endPiece)) return
    const preloadSize = Math.min(raw.pieceLength * 4, file.length)
    const endStart = Math.max(0, file.length - preloadSize)
    const stream = file.createReadStream({ start: endStart })
    let totalRead = 0
    const onData = (chunk: any) => { totalRead += chunk.length }
    const onDone = () => {
      this.preloads.delete(key)
      console.log(`[preload] done ${infoHash.slice(0,12)}/${fileIndex} (${totalRead} bytes)`)
    }
    stream.on('data', onData)
    stream.on('end', onDone)
    stream.on('error', () => { this.preloads.delete(key) })
    const timeout = setTimeout(() => {
      if (!stream.destroyed) stream.destroy()
      this.preloads.delete(key)
      console.log(`[preload] timeout ${infoHash.slice(0,12)}/${fileIndex}`)
    }, 60000)
    this.preloads.set(key, { stream, timeout })
    console.log(`[preload] start ${infoHash.slice(0,12)}/${fileIndex} endStart=${endStart} fileLen=${file.length}`)
  }

  private stopPreload(infoHash: string): void {
    for (const [key, p] of this.preloads) {
      if (key.startsWith(infoHash)) {
        clearTimeout(p.timeout)
        if (!p.stream.destroyed) p.stream.destroy()
        this.preloads.delete(key)
      }
    }
  }

  getFileStream(infoHash: string, fileIndex: number, opts?: { start?: number; end?: number }) {
    const torrent = this.getRawTorrent(infoHash)
    if (!torrent) return undefined
    const file = torrent.files[fileIndex]
    if (!file) return undefined
    return file.createReadStream(opts)
  }

  getProgressiveStream(infoHash: string, fileIndex: number, opts?: { start?: number; end?: number }): import('streamx').Readable | undefined {
    const torrent = this.getRawTorrent(infoHash)
    if (!torrent) return undefined
    const file = torrent.files[fileIndex]
    if (!file) return undefined
    const raw = torrent as unknown as RawTorrent

    const start = opts?.start ?? 0
    const end = opts?.end ?? file.length - 1
    const shortHash = infoHash.slice(0, 12)
    console.log(`[progressive] start file ${shortHash}/${fileIndex} bytes ${start}-${end}`)
    console.log(`[progressive] pieceLength=${raw.pieceLength} bitfield exists=${!!raw.bitfield} store exists=${!!raw.store}`)
    if (raw.bitfield) {
      console.log(`[progressive] piece 0 verified=${raw.bitfield.get(0)}`)
    }

    const self = this
    async function* iterate() {
      const fileOffset = (file as unknown as { offset: number }).offset
      let bytePos = start
      let yielded = 0
      let criticalMarked = new Set<number>()
      let overallTimeout = 120000
      let overallStart = Date.now()

      while (bytePos <= end) {
        if (Date.now() - overallStart > overallTimeout) {
          console.log(`[progressive] overall timeout after ${yielded} bytes`)
          return
        }

        const absolutePos = bytePos + fileOffset
        const pieceIndex = Math.floor(absolutePos / raw.pieceLength)
        if (pieceIndex >= raw.pieces.length) break

        const pieceOffset = absolutePos % raw.pieceLength

        if (raw.bitfield && raw.bitfield.get(pieceIndex)) {
          const remaining = raw.pieceLength - pieceOffset
          const readLen = Math.min(end - bytePos + 1, remaining)
          const buf = await self.readFromStore(raw.store, pieceIndex, pieceOffset, readLen)
          if (!buf || buf.length === 0) break
          console.log(`[progressive] yielded verified piece ${pieceIndex} (${buf.length} bytes)`)
          yielded += buf.length
          yield buf
          bytePos += buf.length
          continue
        }

        const piece = raw.pieces[pieceIndex]
        if (!piece) {
          await sleep(200)
          continue
        }

        if (!criticalMarked.has(pieceIndex)) {
          criticalMarked.add(pieceIndex)
          const endPiece = Math.min(pieceIndex + 2, raw.pieces.length - 1)
          raw.critical(pieceIndex, endPiece)
          console.log(`[progressive] marked pieces ${pieceIndex}-${endPiece} as critical`)
        }

        const blockIndex = Math.floor(pieceOffset / BLOCK_SIZE)
        if (bytePos === start) {
          console.log(`[progressive] waiting for piece ${pieceIndex} block ${blockIndex} (missing=${piece.missing}/${piece.length})`)
        }
        const block = await self.waitForBlock(piece, blockIndex, 60000)
        if (!block) {
          console.log(`[progressive] TIMEOUT on piece ${pieceIndex} block ${blockIndex} (missing=${piece.missing}/${piece.length})`)
          return
        }

        const blockByteOffset = blockIndex * BLOCK_SIZE
        const sliceStart = pieceOffset - blockByteOffset
        const bytesAvail = block.length - sliceStart
        const bytesToYield = Math.min(bytesAvail, end - bytePos + 1)
        if (bytePos === start || yielded % 1048576 === 0) {
          console.log(`[progressive] yielding ${bytesToYield} bytes (total yielded: ${yielded})`)
        }
        yielded += bytesToYield
        yield block.subarray(sliceStart, sliceStart + bytesToYield)
        bytePos += bytesToYield
      }
      console.log(`[progressive] done, total yielded: ${yielded} bytes`)
    }

    return Readable.from(iterate())
  }

  private readFromStore(store: RawStore, index: number, offset: number, length: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      store.get(index, { offset, length }, (err: Error | null, buf: Uint8Array) => {
        resolve(err ? null : buf)
      })
    })
  }

  private waitForBlock(piece: RawPiece, blockIndex: number, timeout: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const start = Date.now()
      const poll = () => {
        const block = piece.get(blockIndex)
        if (block) {
          resolve(block as Uint8Array)
          return
        }
        if (Date.now() - start > timeout) {
          resolve(null)
          return
        }
        setTimeout(poll, 100)
      }
      poll()
    })
  }

  getFileSize(infoHash: string, fileIndex: number): number | undefined {
    const torrent = this.getRawTorrent(infoHash)
    if (!torrent) return undefined
    const file = torrent.files[fileIndex]
    if (!file) return undefined
    return file.length
  }

  destroy(): void {
    if (this.goProcess && !this.goProcess.killed) this.goProcess.kill()
    this.client.destroy()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface RawTorrent {
  pieceLength: number
  pieces: RawPiece[]
  bitfield: { get(index: number): boolean }
  store: RawStore
  select(start: number, end: number, priority: number): void
  critical(start: number, end: number): void
}

interface RawPiece {
  get(blockIndex: number): Uint8Array | null
  length: number
  missing: number
}

interface RawStore {
  get(index: number, opts: { offset: number; length: number }, cb: (err: Error | null, buf: Uint8Array) => void): void
}
