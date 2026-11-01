import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Guards against "mojibake" (e.g. ’ turning into â€™) from a file being saved with the wrong encoding.
const ROOTS = ['src', 'api', 'lib', 'server', 'db', 'index.html']
const MOJIBAKE = /â€|Ã[\x80-\xBF]|ðŸ|Â[·©®°]|�/

function files(entry) {
  const stat = readdirSync(path.dirname(entry), { withFileTypes: true }).find((d) => d.name === path.basename(entry))
  if (stat?.isFile()) return [entry]
  return readdirSync(entry, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(entry, d.name)
    return d.isDirectory() ? files(full) : /\.(jsx?|sql|html|css)$/.test(d.name) ? [full] : []
  })
}

describe('source files', () => {
  const all = ROOTS.flatMap(files)

  it.each(all)('%s is clean UTF-8 (no garbled characters, no BOM)', (file) => {
    const buf = readFileSync(file)
    expect(buf.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), 'starts with a byte-order mark').toBe(false)
    const text = buf.toString('utf8')
    const line = text.split('\n').findIndex((l) => MOJIBAKE.test(l))
    expect(line, line >= 0 ? `garbled text on line ${line + 1}: ${text.split('\n')[line].trim()}` : '').toBe(-1)
  })
})
