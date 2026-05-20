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

export function readConfig(): SetupConfig {
  const path = getConfigPath()
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as SetupConfig
}

export function writeConfig(config: SetupConfig): void {
  const configDir = resolve(projectRoot, 'config')
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
}
