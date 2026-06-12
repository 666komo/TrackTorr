import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ServerConfig } from './types/index.js'
import { getConfigPath } from './setup.js'

export interface RawConfig {
  port: number
  host: string
  indexerUrl: string
  indexerApiKey: string
  downloadDir: string
  username?: string
  password?: string
}

export function loadConfig(): ServerConfig {
  const path = getConfigPath()
  if (!existsSync(path)) {
    console.error(`Config file not found at ${path}`)
    console.error('Copy config/config.example.json to config/config.json and edit it.')
    process.exit(1)
  }

  let raw: RawConfig
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (e) {
    console.error(`Failed to parse config file: ${(e as Error).message}`)
    process.exit(1)
  }

  const errors: string[] = []
  if (!raw.port || typeof raw.port !== 'number') errors.push('port (number)')
  if (!raw.host) errors.push('host')
  if (!raw.downloadDir) errors.push('downloadDir')
  if (raw.indexerUrl && !raw.indexerApiKey) errors.push('indexerApiKey (required when indexerUrl is set)')
  if (!raw.indexerUrl && raw.indexerApiKey) errors.push('indexerUrl (required when indexerApiKey is set)')

  if (errors.length > 0) {
    console.error(`Config file missing or invalid: ${errors.join(', ')}`)
    process.exit(1)
  }

  return {
    port: raw.port,
    host: raw.host,
    indexer: raw.indexerUrl && raw.indexerApiKey
      ? { url: raw.indexerUrl, apiKey: raw.indexerApiKey }
      : undefined,
    downloadDir: raw.downloadDir,
    username: raw.username,
    password: raw.password,
  }
}