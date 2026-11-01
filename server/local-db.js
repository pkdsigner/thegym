// Local-only Postgres (PGlite, embedded in Node) used while DATABASE_URL is empty.
// Data lives in .data/pglite so it survives restarts. Never used on Vercel.
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LOCAL_DB_DIR = path.join(root, '.data', 'pglite')

// dir: folder to persist to (default .data/pglite), or null for a throwaway in-memory database
export async function openLocalDb({ dir = LOCAL_DB_DIR, setup = true } = {}) {
  if (dir) await mkdir(dir, { recursive: true })
  const db = dir ? new PGlite(dir) : new PGlite()
  await db.waitReady

  if (setup) {
    for (const file of ['schema.sql', 'seed.sql']) {
      await db.exec(await readFile(path.join(root, 'db', file), 'utf8'))
    }
  }

  // Same calling style as Neon's sql`...` tagged template: returns the rows array.
  const sql = async (strings, ...values) => {
    const text = strings.reduce((acc, part, i) => `${acc}$${i}${part}`)
    return (await db.query(text, values)).rows
  }

  return { db, sql, dir }
}
