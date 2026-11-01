// Local stand-in for Vercel: serves the /api folder on http://localhost:3001 (Vite proxies /api here).
import { createApp } from './app.js'

const PORT = Number(process.env.API_PORT) || 3001

// No Neon URL yet → use the embedded local Postgres (schema + seed applied automatically).
// PULSEFIT_DB_DIR=memory gives a throwaway in-memory database (used by the browser tests).
let localDb = null
if (!process.env.DATABASE_URL) {
  const { openLocalDb, LOCAL_DB_DIR } = await import('./local-db.js')
  const dir = process.env.PULSEFIT_DB_DIR === 'memory' ? null : process.env.PULSEFIT_DB_DIR || LOCAL_DB_DIR
  localDb = await openLocalDb({ dir })
  globalThis.__pulsefitLocalSql = localDb.sql
}

const { app, routes } = await createApp()

const server = app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT} (${routes.length} routes)`)
  console.log(
    !localDb
      ? 'Database: Neon (DATABASE_URL)'
      : localDb.dir
        ? 'Database: LOCAL (.data/pglite) — add DATABASE_URL to .env to switch to Neon'
        : 'Database: in-memory (test run, nothing is saved)',
  )
})

// Close the local database cleanly so its files are never left half-written
async function shutdown() {
  server.close()
  await localDb?.db.close().catch(() => {})
  process.exit(0)
}
process.on('message', (msg) => msg === 'shutdown' && shutdown())
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
