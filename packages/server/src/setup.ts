import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const _filename = fileURLToPath(import.meta.url)
const _dirname = dirname(_filename)
const projectRoot = resolve(_dirname, '..', '..', '..')

export interface SetupConfig {
  port: number
  host: string
  indexerUrl: string
  indexerApiKey: string
  downloadDir: string
}

export function getConfigPath(): string {
  return resolve(projectRoot, 'config', 'config.json')
}

export function configExists(): boolean {
  return existsSync(getConfigPath())
}

export function writeConfig(config: SetupConfig): void {
  const configDir = resolve(projectRoot, 'config')
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
}

export function readConfig(): SetupConfig {
  const path = getConfigPath()
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as SetupConfig
}

export async function runSetup(): Promise<void> {
  const existing = configExists() ? readConfig() : null

  const rl = createInterface({ input, output })

  const portStr = await rl.question(
    `Server port ${existing ? `(${existing.port})` : '[3030]'}: `
  )
  const port = parseInt(portStr, 10) || existing?.port || 3030

  const host = await rl.question(
    `Server host ${existing ? `(${existing.host})` : '[0.0.0.0]'}: `
  ) || existing?.host || '0.0.0.0'

  const indexerUrl = await rl.question(
    `Indexer URL (Prowlarr/Jackett) - leave empty to skip ${existing?.indexerUrl ? `(${existing.indexerUrl})` : ''}: `
  ) || existing?.indexerUrl || ''

  const indexerApiKey = await rl.question(
    `Indexer API key ${existing?.indexerApiKey ? '(already set)' : ''}: `
  ) || existing?.indexerApiKey || ''

  const downloadDir = await rl.question(
    `Download directory ${existing ? `(${existing.downloadDir})` : '[/tmp/tracktorr-downloads]'}: `
  ) || existing?.downloadDir || '/tmp/tracktorr-downloads'

  rl.close()

  const config: SetupConfig = { port, host, indexerUrl, indexerApiKey, downloadDir }

  writeConfig(config)
  console.log('Configuration saved to config/config.json')
}
