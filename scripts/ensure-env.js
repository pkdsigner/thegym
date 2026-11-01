// Makes sure .env exists with a JWT_SECRET, and explains how to get DATABASE_URL.
// Usage: node scripts/ensure-env.js
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const ENV_PATH = '.env'
let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''

const read = (key) =>
  text
    .match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '')

function set(key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`
}

let changed = !existsSync(ENV_PATH)
if (read('DATABASE_URL') === undefined) {
  set('DATABASE_URL', '')
  changed = true
}
if (!read('JWT_SECRET')) {
  set('JWT_SECRET', randomBytes(48).toString('base64url'))
  changed = true
  console.log('✓ Generated a strong random JWT_SECRET and saved it to .env')
}
if (changed) writeFileSync(ENV_PATH, text)

if (!read('DATABASE_URL')) {
  console.log(`
┌──────────────────────────────────────────────────────────────────────┐
│  No DATABASE_URL yet → using a LOCAL database (.data/pglite)         │
│  Your data is saved on this computer. To switch to Neon later:       │
├──────────────────────────────────────────────────────────────────────┤
│  1. Go to https://console.neon.tech and sign in (free plan is fine)  │
│  2. Open your project (or click "New Project" to create one)         │
│  3. On the Project Dashboard, click the "Connect" button (top right) │
│  4. Keep branch "main", database "neondb", and click "Copy snippet"  │
│     next to the connection string. It starts with  postgresql://     │
│     and contains  sslmode=require                                    │
│  5. Paste it into .env so the line reads:                            │
│        DATABASE_URL=postgresql://...                                 │
│  6. Run:  npm run db:setup   then   npm run dev                      │
└──────────────────────────────────────────────────────────────────────┘
`)
}
