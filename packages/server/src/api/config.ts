import { Router } from 'express'
import { readConfig, writeConfig, configExists } from '../setup.js'

export function createConfigRouter(): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    if (!configExists()) {
      res.json({ port: 3030, host: '0.0.0.0', indexerUrl: '', indexerApiKey: '', downloadDir: '/tmp/tracktorr-downloads' })
      return
    }
    const cfg = readConfig()
    res.json(cfg)
  })

  router.put('/', (req, res) => {
    const { port, host, indexerUrl, indexerApiKey, downloadDir } = req.body

    if (!port || !host || !downloadDir) {
      res.status(400).json({ error: 'port, host, and downloadDir are required' })
      return
    }

    writeConfig({
      port: parseInt(port, 10) || 3030,
      host,
      indexerUrl: indexerUrl || '',
      indexerApiKey: indexerApiKey || '',
      downloadDir,
    })

    res.json({ success: true, message: 'Configuration saved. Restart the server for some changes to take effect.' })
  })

  return router
}
