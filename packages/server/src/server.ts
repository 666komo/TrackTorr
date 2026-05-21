import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { createTorrentRouter } from './api/torrents.js'
import { createSearchRouter } from './api/search.js'
import { createStreamRouter } from './api/stream.js'
import { createConfigRouter } from './api/config.js'
import { createMaintenanceRouter } from './api/maintenance.js'
import { TorrentEngine } from './torrent/engine.js'
import { readConfig, configExists } from './setup.js'
import type { ServerConfig } from './types/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist')

export function createServer(config: ServerConfig) {
  const app = express()
  const engine = new TorrentEngine(config.downloadDir)

  app.use(cors())
  app.use(express.json())

  app.use('/api/torrents', createTorrentRouter(engine))
  app.use('/api/search', createSearchRouter())
  app.use('/api/stream', createStreamRouter(engine))
  app.use('/api/config', createConfigRouter())
  app.use('/api/maintenance', createMaintenanceRouter(engine, config.downloadDir))

  const hasIndexer = config.indexer?.url && config.indexer?.apiKey

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', indexer: !!hasIndexer })
  })

  // Serve built frontend for production (must be after API routes)
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

  const start = () => {
    app.listen(config.port, config.host, () => {
      console.log(`TrackTorr server running on http://${config.host}:${config.port}`)
    })
  }

  const stop = () => {
    engine.destroy()
  }

  return { app, engine, start, stop }
}
