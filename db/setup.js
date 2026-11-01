// Runs db/schema.sql then db/seed.sql and prints row counts.
// Uses Neon when DATABASE_URL is set, otherwise the local database in .data/pglite.
import { readFile } from 'node:fs/promises'

const COUNTS = `
  SELECT 'exercises' AS "table", count(*)::int AS "rows" FROM exercises
  UNION ALL SELECT 'classes', count(*)::int FROM classes
  UNION ALL SELECT 'users', count(*)::int FROM users
  UNION ALL SELECT 'workouts', count(*)::int FROM workouts`

async function setupNeon() {
  const { Pool } = await import('@neondatabase/serverless')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    for (const file of ['schema.sql', 'seed.sql']) {
      await pool.query(await readFile(new URL(file, import.meta.url), 'utf8'))
      console.log(`✓ Ran db/${file} on Neon`)
    }
    return (await pool.query(COUNTS)).rows
  } finally {
    await pool.end()
  }
}

async function setupLocal() {
  // The dev server keeps the local database open; two processes must not write to it at once.
  const running = await fetch('http://localhost:3001/api/auth/me').then(() => true, () => false)
  if (running) {
    console.log('ℹ The dev server is running and already applied schema.sql + seed.sql to the local database on startup.')
    console.log('  Stop it (Ctrl+C) and run "npm run db:setup" again if you want to see the row counts here.')
    process.exit(0)
  }
  const { openLocalDb } = await import('../server/local-db.js')
  const { db } = await openLocalDb({ setup: false })
  try {
    for (const file of ['schema.sql', 'seed.sql']) {
      await db.exec(await readFile(new URL(file, import.meta.url), 'utf8'))
      console.log(`✓ Ran db/${file} on the LOCAL database (.data/pglite)`)
    }
    return (await db.query(COUNTS)).rows
  } finally {
    await db.close()
  }
}

try {
  const rows = process.env.DATABASE_URL ? await setupNeon() : await setupLocal()
  console.table(rows)
} catch (err) {
  console.error('\n✗ Database setup failed:', err.message)
  if (process.env.DATABASE_URL) console.error('  Check that DATABASE_URL in .env is the full Neon connection string and that you are online.\n')
  process.exitCode = 1
}
