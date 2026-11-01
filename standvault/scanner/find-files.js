// Step 1 of the scan: list every .max file under the scan folders. Read-only.
// Output: scanner/output/files.json
import { readdirSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const settings = JSON.parse(readFileSync(join(here, '..', 'config', 'settings.json'), 'utf8'));
const outDir = join(here, 'output');
mkdirSync(outDir, { recursive: true });

const excluded = settings.excludeFolders.map((f) => resolve(f).toLowerCase());
const isExcluded = (p) => excluded.some((e) => p.toLowerCase() === e || p.toLowerCase().startsWith(e + '\\'));

// Autosave / backup copies are listed separately, not catalogued.
// Any folder with backup/autoback/autosave in its name counts (e.g. "_claude_backups").
const BACKUP = /(^|\\)[^\\]*(autoback|autobak|autosave|backup)[^\\]*\\|(^|\\)bak\\|autobak\d*\.max$|autosave\d*\.max$|_backup\.max$|\.bak\.max$/i;

const ARCHIVE = new Set(['.zip', '.rar', '.7z']);

const files = [];
const backups = [];
const archives = []; // looked inside by scan-archives.js
const unreadable = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    unreadable.push({ path: dir, error: e.code });
    return;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!isExcluded(p)) walk(p);
    } else if (ent.isFile() && extname(ent.name).toLowerCase() === '.max') {
      let st;
      try {
        st = statSync(p);
      } catch (e) {
        unreadable.push({ path: p, error: e.code });
        continue;
      }
      const rec = { path: p, name: basename(p), folder: dir, size: st.size, modified: st.mtime.toISOString() };
      (BACKUP.test(p) ? backups : files).push(rec);
    } else if (ent.isFile() && ARCHIVE.has(extname(ent.name).toLowerCase()) && !BACKUP.test(p)) {
      try {
        const st = statSync(p);
        archives.push({ path: p, name: basename(p), folder: dir, size: st.size, modified: st.mtime.toISOString() });
      } catch (e) {
        unreadable.push({ path: p, error: e.code });
      }
    }
  }
}

const t0 = Date.now();
for (const root of settings.scanFolders) walk(resolve(root));
const seconds = ((Date.now() - t0) / 1000).toFixed(1);

files.sort((a, b) => a.path.localeCompare(b.path));
archives.sort((a, b) => a.path.localeCompare(b.path));
writeFileSync(join(outDir, 'files.json'), JSON.stringify({ scannedAt: new Date().toISOString(), seconds, files, backups, archives, unreadable }, null, 2));

const gb = (n) => (n / 1024 ** 3).toFixed(1);
console.log(`Found ${files.length} .max files (${gb(files.reduce((s, f) => s + f.size, 0))} GB) in ${seconds}s`);
console.log(`Backups/autosaves set aside: ${backups.length}   Archives (.zip/.rar/.7z): ${archives.length}   Unreadable folders/files: ${unreadable.length}`);
