import { Router } from 'express'
import type { TorrentEngine } from '../torrent/engine.js'
import type { AddTorrentRequest, SelectFilesRequest } from '../types/index.js'

function isMagnet(str: string): boolean {
  return str.startsWith('magnet:')
}

function isInfoHash(str: string): boolean {
  return /^[a-fA-F0-9]{40}$/.test(str.trim())
}

export function createTorrentRouter(engine: TorrentEngine): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    const torrents = engine.getAllTorrents()
    res.json(torrents)
  })

  router.get('/:infoHash', (req, res) => {
    const status = engine.getTorrentStatus(req.params.infoHash)
    if (!status) {
      res.status(404).json({ error: 'Torrent not found' })
      return
    }
    res.json(status)
  })

  router.post('/', async (req, res) => {
    const body = req.body as AddTorrentRequest

    try {
      const input = body.magnet || ''
      let result: { infoHash: string; name: string }

      if (isMagnet(input)) {
        result = await engine.addMagnet(input)
      } else if (isInfoHash(input)) {
        result = await engine.addInfoHash(input.trim())
      } else if (input.startsWith('http://') || input.startsWith('https://')) {
        const resp = await fetch(input)
        if (!resp.ok) throw new Error(`Failed to download torrent file: ${resp.status}`)
        const buffer = Buffer.from(await resp.arrayBuffer())
        result = await engine.addTorrentFile(buffer)
      } else if (body.infoHash) {
        result = await engine.addInfoHash(body.infoHash)
      } else {
        res.status(400).json({ error: 'Provide magnet link, infoHash, or torrent URL' })
        return
      }

      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  router.post('/:infoHash/select', (req, res) => {
    const { infoHash } = req.params
    const { files } = req.body as SelectFilesRequest

    if (!Array.isArray(files) || files.some((f) => typeof f !== 'number')) {
      res.status(400).json({ error: 'files must be an array of numbers' })
      return
    }

    engine.selectFiles(infoHash, files)
    res.json({ success: true })
  })

  router.post('/:infoHash/deselect', (req, res) => {
    const { infoHash } = req.params
    const { files } = req.body as SelectFilesRequest

    if (!Array.isArray(files) || files.some((f) => typeof f !== 'number')) {
      res.status(400).json({ error: 'files must be an array of numbers' })
      return
    }

    engine.deselectFiles(infoHash, files)
    res.json({ success: true })
  })

  router.delete('/:infoHash', (req, res) => {
    engine.remove(req.params.infoHash)
    res.json({ success: true })
  })

  return router
}
