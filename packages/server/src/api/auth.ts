import { Router } from 'express'
import crypto from 'node:crypto'
import type { ServerConfig } from '../types/index.js'

const tokens = new Set<string>()

export function createAuthRouter(config: ServerConfig) {
  const router = Router()

  router.post('/login', (req, res) => {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' })
      return
    }
    if (username !== config.username || password !== config.password) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }
    const token = crypto.randomBytes(32).toString('hex')
    tokens.add(token)
    res.json({ token })
  })

  router.post('/logout', (req, res) => {
    const auth = req.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      tokens.delete(auth.slice(7))
    }
    res.json({ success: true })
  })

  router.get('/check', (req, res) => {
    const auth = req.headers.authorization
    const valid = auth?.startsWith('Bearer ') && tokens.has(auth.slice(7))
    res.json({ authenticated: !!valid })
  })

  return router
}

export function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ') || !tokens.has(auth.slice(7))) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
