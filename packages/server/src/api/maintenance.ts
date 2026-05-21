import { Router } from 'express'
import { rm, readdir } from 'node:fs/promises'
import path from 'node:path'
import { TorrentEngine } from '../torrent/engine.js'

export function createMaintenanceRouter(engine: TorrentEngine, downloadDir: string): Router {
  const router = Router()

  router.post('/flush-cache', async (_req, res) => {
    try {
      const cacheDir = path.join(downloadDir, '_transcode_cache')
      await rm(cacheDir, { recursive: true, force: true })
      res.json({ success: true, message: 'Transcode cache cleared.' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/flush-downloads', async (_req, res) => {
    try {
      engine.removeAll()

      // Give Go/WebTorrent a moment to release file handles
      await new Promise((r) => setTimeout(r, 1000))

      // Remove all files in downloadDir except the cache directory
      const entries = await readdir(downloadDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(downloadDir, entry.name)
        if (entry.name === '_transcode_cache') continue
        await rm(fullPath, { recursive: true, force: true })
      }

      res.json({ success: true, message: 'Downloads cleared.' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
