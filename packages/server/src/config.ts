import type { ServerConfig } from './types/index.js'
import { configExists, readConfig, writeConfig } from './setup.js'

export function loadConfig(): ServerConfig {
  const env = {
    port: parseInt(process.env.PORT || '', 10),
    host: process.env.HOST || '',
    indexerUrl: process.env.INDEXER_URL || '',
    indexerApiKey: process.env.INDEXER_API_KEY || '',
    downloadDir: process.env.DOWNLOAD_DIR || '',
  }

  // If env vars are set, write them to config file for persistence
  if (env.indexerUrl && env.indexerApiKey) {
    writeConfig({
      port: env.port || 3030,
      host: env.host || '0.0.0.0',
      indexerUrl: env.indexerUrl,
      indexerApiKey: env.indexerApiKey,
      downloadDir: env.downloadDir || '/data/downloads',
    })
  }

  const cfg = configExists() ? readConfig() : {
    port: 3030,
    host: '0.0.0.0',
    indexerUrl: '',
    indexerApiKey: '',
    downloadDir: '/data/downloads',
  }

  return {
    port: env.port || cfg.port,
    host: env.host || cfg.host,
    indexer: (env.indexerUrl || cfg.indexerUrl) && (env.indexerApiKey || cfg.indexerApiKey)
      ? { url: env.indexerUrl || cfg.indexerUrl, apiKey: env.indexerApiKey || cfg.indexerApiKey }
      : undefined,
    downloadDir: env.downloadDir || cfg.downloadDir,
  }
}
