import { Router } from 'express'
import { IndexerClient } from '../indexer/client.js'
import { readConfig, configExists } from '../setup.js'
import type { IndexerConfig } from '../types/index.js'

export function createSearchRouter(): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    if (!configExists()) {
      res.status(503).json({ error: 'No indexer configured. Set indexer URL and API key in settings.' })
      return
    }

    const cfg = readConfig()
    if (!cfg.indexerUrl || !cfg.indexerApiKey) {
      res.status(503).json({ error: 'No indexer configured. Set indexer URL and API key in settings.' })
      return
    }

    const query = req.query.q as string
    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: 'Query parameter q is required' })
      return
    }

    try {
      const indexer = new IndexerClient({ url: cfg.indexerUrl, apiKey: cfg.indexerApiKey })
      const results = await indexer.search(query, req.query.category as string)
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  return router
}
