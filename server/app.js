// Builds an Express app that serves every file in /api as a route, exactly like Vercel does.
// api/stats.js -> /api/stats, api/auth/login.js -> /api/auth/login, api/workouts/index.js -> /api/workouts
// Used by the local dev server (server/dev.js) and by the backend tests (Supertest).
import express from 'express'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiDir = path.join(root, 'api')

export function collectRoutes(dir = apiDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) return []
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectRoutes(full)
    if (!entry.name.endsWith('.js')) return []
    const rel = path.relative(apiDir, full).replace(/\\/g, '/').replace(/\.js$/, '')
    const route = '/api/' + rel.replace(/(^|\/)index$/, '')
    return [{ route: route.replace(/\/$/, '') || '/api', file: full }]
  })
}

export async function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  const routes = collectRoutes()
  for (const { route, file } of routes) {
    const { default: handle } = await import(pathToFileURL(file).href)
    app.all(route, async (req, res) => {
      try {
        await handle(req, res)
      } catch (err) {
        console.error(`[api] ${req.method} ${route} crashed:`, err)
        if (!res.headersSent) res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
      }
    })
  }

  app.use('/api', (req, res) => res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` }))
  // Malformed JSON bodies → friendly 400 instead of an HTML error page
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' })
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' })
    next(err)
  })

  return { app, routes }
}
