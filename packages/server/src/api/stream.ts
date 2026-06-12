import { Router } from 'express'
import http from 'node:http'
import { TorrentEngine } from '../torrent/engine.js'

const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 10 })

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
  '.mka': 'audio/x-matroska',
}

function getMime(name: string): string {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'))
  return MIME_MAP[ext] || 'application/octet-stream'
}

function pipeStream(rd: any, res: import('express').Response): void {
  let bytesWritten = 0
  const log = setInterval(() => {
    if (bytesWritten === 0) console.log('[stream] WARNING: no data after 5s!')
  }, 5000)

  rd.on('data', (chunk: Uint8Array) => { bytesWritten += chunk.length })
  rd.on('end', () => { clearInterval(log); console.log(`[stream] ended, total: ${bytesWritten} bytes`) })
  res.on('close', () => { clearInterval(log); console.log(`[stream] client closed after ${bytesWritten} bytes`); rd.destroy() })
  rd.on('error', (err: Error) => { clearInterval(log); console.log('[stream] error:', err.message); if (!res.headersSent) res.status(500).end() })
  rd.pipe(res)
}

async function tryGoProbe(
  port: number,
  infoHash: string,
  fileIndex: number,
  rangeHeader: string,
): Promise<{ ok: true; statusCode: number } | { ok: false }> {
  return new Promise((resolve) => {
    const goReq = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/stream/${infoHash}/${fileIndex}`,
        method: 'HEAD',
        agent: keepAliveAgent,
        headers: rangeHeader ? { Range: rangeHeader } : undefined,
      },
      (goRes) => {
        goRes.resume()
        resolve({ ok: true, statusCode: goRes.statusCode || 500 })
      },
    )
    goReq.on('error', () => resolve({ ok: false }))
    goReq.end()
  })
}

async function proxyViaGo(
  engine: TorrentEngine,
  res: import('express').Response,
  infoHash: string,
  fileIndex: number,
  mime: string,
  rangeHeader: string,
): Promise<boolean> {
  const port = engine.goStreamerPort
  if (!port) return false

  const maxRetries = 5
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await tryGoProbe(port, infoHash, fileIndex, rangeHeader)
    if (!result.ok) return false

    if (result.statusCode === 200 || result.statusCode === 206) {
      const goReq = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: `/stream/${infoHash}/${fileIndex}`,
            method: 'GET',
            agent: keepAliveAgent,
            headers: rangeHeader ? { Range: rangeHeader } : undefined,
        },
        (goRes) => {
          res.writeHead(goRes.statusCode!, {
            'Content-Type': goRes.headers['content-type'] || mime,
            'Content-Range': goRes.headers['content-range'] || '',
            'Content-Length': goRes.headers['content-length'] || '',
            'Accept-Ranges': 'bytes',
          })
          goRes.pipe(res)
          res.on('close', () => goReq.destroy())
        },
      )
      goReq.on('error', () => { /* client already handled */ })
      goReq.end()
      return true
    }

    if (result.statusCode === 404) {
      console.log(`[stream] Go 404 attempt ${attempt + 1}/${maxRetries}, re-sending add command`)
      engine.sendGoAdd(infoHash)
      await new Promise((r) => setTimeout(r, 1000))
      continue
    }

    return false
  }

  console.log('[stream] Go still 404 after retries, falling back to WebTorrent')
  return false
}

export function createStreamRouter(engine: TorrentEngine): Router {
  const router = Router()

  router.get('/transcode/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params
    const port = engine.goStreamerPort
    if (!port) {
      res.status(503).json({ error: 'Streamer not available' })
      return
    }
    console.log(`[stream] transcode request: ${infoHash.slice(0,12)}/${fileIndex}`)
    const goParams = new URLSearchParams({ transcode: '1' })
    if (req.query.audio_index) goParams.set('audio_index', req.query.audio_index as string)
    if (req.query.subtitle_index) goParams.set('subtitle_index', req.query.subtitle_index as string)
    const goUrl = `http://127.0.0.1:${port}/stream/${infoHash}/${fileIndex}?${goParams}`
    const goReq = http.get(goUrl, { agent: keepAliveAgent }, (goRes) => {
      res.writeHead(goRes.statusCode!, {
        'Content-Type': goRes.headers['content-type'] || 'video/mp4',
        'Cache-Control': goRes.headers['cache-control'] || 'no-store',
      })
      goRes.pipe(res)
      res.on('close', () => goReq.destroy())
    })
    goReq.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'Transcode failed' }) })
    goReq.end()
  })

  router.get('/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params
    const torrent = engine.getTorrent(infoHash)

    if (!torrent) {
      res.status(404).json({ error: 'Torrent not found' })
      return
    }

    const index = parseInt(fileIndex, 10)
    const file = torrent.files[index]

    if (!file) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const mime = getMime(file.name)
    const fileSize = file.length
    const rangeHeader = req.headers.range || ''
    console.log(`[stream] request: ${infoHash.slice(0,12)}/${index} mime=${mime} size=${fileSize} range=${rangeHeader || 'none'}`)

    if (engine.goAvailable && engine.goStreamerPort) {
      const usedGo = await proxyViaGo(engine, res, infoHash, index, mime, rangeHeader)
      if (usedGo) return
    }

    fallback(engine, res, req, infoHash, index, fileSize, mime)
  })

  router.get('/probe/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params
    const port = engine.goStreamerPort
    if (!port) {
      res.status(503).json({ error: 'Streamer not available' })
      return
    }
    const goReq = http.get(
      `http://127.0.0.1:${port}/probe/${infoHash}/${fileIndex}`,
      { agent: keepAliveAgent },
      (goRes) => {
        res.writeHead(goRes.statusCode!, { 'Content-Type': 'application/json' })
        goRes.pipe(res)
      },
    )
    goReq.on('error', () => res.status(502).json({ error: 'Probe failed' }))
    goReq.end()
  })

  router.get('/subtitle/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params
    const subIdx = req.query.subtitle_index as string
    if (!subIdx) {
      res.status(400).json({ error: 'missing subtitle_index' })
      return
    }
    const port = engine.goStreamerPort
    if (!port) {
      res.status(503).json({ error: 'Streamer not available' })
      return
    }
    const goReq = http.get(
      `http://127.0.0.1:${port}/subtitle/${infoHash}/${fileIndex}?subtitle_index=${subIdx}`,
      { agent: keepAliveAgent },
      (goRes) => {
        res.writeHead(goRes.statusCode!, {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Cache-Control': goRes.headers['cache-control'] || 'no-store',
        })
        goRes.pipe(res)
        res.on('close', () => goReq.destroy())
      },
    )
    goReq.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'Subtitle failed' }) })
    goReq.end()
  })

  router.post('/playback/:infoHash', async (req, res) => {
    const { infoHash } = req.params
    const port = engine.goStreamerPort
    if (!port) {
      res.status(503).json({ error: 'Streamer not available' })
      return
    }
    const goReq = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/playback/${infoHash}`,
        method: 'POST',
        agent: keepAliveAgent,
        headers: { 'Content-Type': 'application/json' },
      },
      (goRes) => {
        res.writeHead(goRes.statusCode!, { 'Content-Type': 'application/json' })
        goRes.pipe(res)
      },
    )
    req.pipe(goReq)
    goReq.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'Playback save failed' }) })
    goReq.end()
  })

  return router
}

function fallback(
  engine: TorrentEngine,
  res: import('express').Response,
  req: import('express').Request,
  infoHash: string,
  fileIndex: number,
  fileSize: number,
  mime: string,
): void {
  console.log('[stream] using WebTorrent fallback')
  engine.selectForStream(infoHash, fileIndex)
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const end = Math.min(requestedEnd, fileSize - 1)
    const chunkSize = end - start + 1

    const stream = engine.getProgressiveStream(infoHash, fileIndex, { start, end })
    if (!stream) { res.status(500).json({ error: 'Could not create stream' }); return }

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mime,
    })
    pipeStream(stream, res)
  } else {
    const stream = engine.getProgressiveStream(infoHash, fileIndex)
    if (!stream) { res.status(500).json({ error: 'Could not create stream' }); return }

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
    })
    pipeStream(stream, res)
  }
}
