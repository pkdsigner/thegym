// Step 2 of the scan: read the stored metadata and thumbnail of every .max file found in step 1. Read-only.
// Input: scanner/output/files.json   Output: scanner/output/metadata.json, scanner/output/thumbs/<id>.png
// Each result is also appended to metadata-cache.ndjson, so an interrupted run resumes where it stopped
// (files whose size or date changed are read again).
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readMaxInfo, thumbnailPng } from './max-info.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'output');
const thumbDir = join(outDir, 'thumbs');
mkdirSync(thumbDir, { recursive: true });

const { files } = JSON.parse(readFileSync(join(outDir, 'files.json'), 'utf8'));
const idFor = (path) => createHash('sha1').update(path.toLowerCase()).digest('hex').slice(0, 12);

const cachePath = join(outDir, 'metadata-cache.ndjson');
const cacheKey = (f) => `${f.path}|${f.size}|${f.modified}`;
const cache = new Map();
if (existsSync(cachePath)) {
  for (const line of readFileSync(cachePath, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const { key, record } = JSON.parse(line);
      cache.set(key, record);
    } catch {} // a line cut short by an interruption
  }
}

const results = [];
const failed = [];
const t0 = Date.now();
let fresh = 0;

files.forEach((f, n) => {
  const key = cacheKey(f);
  let record = cache.get(key);
  if (!record) {
    const id = idFor(f.path);
    try {
      const { thumbnail, ...info } = readMaxInfo(f.path);
      const png = thumbnailPng(thumbnail);
      if (png) writeFileSync(join(thumbDir, `${id}.png`), png);
      record = { id, ...f, ...info, thumbnail: png ? `thumbs/${id}.png` : null };
    } catch (e) {
      record = { id, ...f, error: e.message };
    }
    appendFileSync(cachePath, JSON.stringify({ key, record }) + '\n');
    fresh++;
  }
  (record.error ? failed : results).push(record);
  if ((n + 1) % 25 === 0) {
    const secs = (Date.now() - t0) / 1000;
    const left = fresh ? Math.round(((files.length - n - 1) * secs) / fresh / 60) : 0;
    process.stdout.write(`  ${n + 1}/${files.length}  (~${left} min left)   \r`);
  }
});

const seconds = ((Date.now() - t0) / 1000).toFixed(1);
writeFileSync(join(outDir, 'metadata.json'), JSON.stringify({ readAt: new Date().toISOString(), seconds, files: results, failed }, null, 2));

const tally = (key) =>
  Object.entries(results.reduce((m, r) => ((m[r[key] ?? 'unknown'] = (m[r[key] ?? 'unknown'] || 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');

const maxYear = Number(JSON.parse(readFileSync(join(here, '..', 'config', 'settings.json'), 'utf8')).maxVersion);
const tooNew = results.filter((r) => r.savedAsYear > maxYear);

process.stdout.write(' '.repeat(20) + '\r');
console.log(`Read ${results.length} of ${files.length} files in ${seconds}s. Failed: ${failed.length}`);
console.log(`Renderer:   ${tally('renderer')}`);
console.log(`Saved for:  ${tally('savedAsYear')}`);
console.log(`Thumbnails: ${results.filter((r) => r.thumbnail).length}   No summary data: ${results.filter((r) => !r.hasSummary).length}`);
if (tooNew.length) console.log(`Saved by a newer Max than ${maxYear} (left out of the inventory): ${tooNew.length}`);
