import { createServer } from './server.js'
import { loadConfig } from './config.js'

async function main() {
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