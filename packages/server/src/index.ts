import { createServer } from './server.js'
import { loadConfig } from './config.js'
import { runSetup, configExists } from './setup.js'

async function main() {
  // In Docker/k8s, env vars take precedence — skip interactive setup
  const hasEnvConfig = !!(process.env.INDEXER_URL && process.env.INDEXER_API_KEY)
  if (!configExists() && !hasEnvConfig) {
    console.log('No configuration found. Starting first-launch setup...\n')
    await runSetup()
    console.log()
  }

  const config = loadConfig()
  const server = createServer(config)
  server.start()

  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    server.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    server.stop()
    process.exit(0)
  })

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message)
  })

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
  })
}

main()
