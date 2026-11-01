// Step 2, archives: find .max files inside the .zip/.rar/.7z archives listed in step 1. Read-only for the archives.
// A .max that is already on disk unzipped (same name and size) is only noted. Any other is extracted on its own
// into scanner/output/_archive-tmp, read like a loose file, and deleted straight away.
// Uses the tar.exe built into Windows. Results are cached per archive, so an interrupted run resumes.
// Output: scanner/output/archive-metadata.json, scanner/output/thumbs/<id>.png
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readMaxInfo, thumbnailPng } from './max-info.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'output');
const tmpDir = join(outDir, '_archive-tmp');
const thumbDir = join(outDir, 'thumbs');
const cachePath = join(outDir, 'archive-cache.json');
mkdirSync(thumbDir, { recursive: true });

const { files, archives = [] } = JSON.parse(readFileSync(join(outDir, 'files.json'), 'utf8'));
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const loose = new Map(files.map((f) => [`${f.name.toLowerCase()}|${f.size}`, f.path]));
const BACKUP = /autoback|autobak|autosave|backup/i;
const idFor = (path) => createHash('sha1').update(path.toLowerCase()).digest('hex').slice(0, 12);
const tar = (args) => spawnSync('tar', args, { encoding: 'utf8', maxBuffer: 512 * 2 ** 20, windowsHide: true });

// "-rw-rw-r--  0 0      0    20451328 Feb 19  2022 folder/name.max"
const LINE = /^([-dl])\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\w{3}\s+\d+\s+[\d:]+\s(.*)$/;

// tar can't handle entry names outside the console code page (Cyrillic, Chinese...). For .zip files the
// .NET zip reader built into Windows can, so it takes over when tar reports a problem with a zip.
const ZIP_PS = {
  list: `[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.IO.Compression.FileSystem;
    $z=[IO.Compression.ZipFile]::OpenRead($env:SV_ZIP); try { $z.Entries | ? { $_.Name } | % { [pscustomobject]@{path=$_.FullName; size=$_.Length} } | ConvertTo-Json -Compress } finally { $z.Dispose() }`,
  extract: `Add-Type -AssemblyName System.IO.Compression.FileSystem;
    $z=[IO.Compression.ZipFile]::OpenRead($env:SV_ZIP); try { $e=$z.GetEntry($env:SV_ENTRY); [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $env:SV_OUT, $true) } finally { $z.Dispose() }`,
};
const powershell = (script, env) =>
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    maxBuffer: 512 * 2 ** 20,
    windowsHide: true,
    env: { ...process.env, ...env },
  });
const isZip = (p) => p.toLowerCase().endsWith('.zip');

function list(archive) {
  const res = tar(['-tvf', archive]);
  const entries = [];
  for (const line of (res.stdout || '').split(/\r?\n/)) {
    const m = line.match(LINE);
    if (m && m[1] === '-') entries.push({ path: m[3], size: Number(m[2]) });
  }
  if (res.status === 0) return { entries, via: 'tar', error: null };
  if (isZip(archive)) {
    const ps = powershell(ZIP_PS.list, { SV_ZIP: archive });
    if (ps.status === 0) return { entries: [JSON.parse(ps.stdout.trim() || '[]')].flat(), via: 'dotnet', error: null };
  }
  const error = (res.stderr || '').split(/\r?\n/).filter((l) => l && !/delayed/.test(l)).pop() || `tar exit ${res.status}`;
  return { entries, via: 'tar', error: /unreadable filename/.test(error) ? 'file names tar cannot read - needs 7-Zip' : error };
}

function extract(archive, entry, via) {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  if (via === 'dotnet') {
    const out = join(tmpDir, 'scene.max');
    powershell(ZIP_PS.extract, { SV_ZIP: archive, SV_ENTRY: entry.path, SV_OUT: out });
    return existsSync(out) ? out : null;
  }
  tar(['-xf', archive, '-C', tmpDir, entry.path]);
  let found = join(tmpDir, ...entry.path.split('/'));
  if (existsSync(found)) return found;
  // Names tar can't pass back exactly (non-Latin characters): extract every .max and pick the one with the right size.
  tar(['-xf', archive, '-C', tmpDir, '--include', '*.max']);
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  return walk(tmpDir).find((p) => p.toLowerCase().endsWith('.max') && statSync(p).size === entry.size) || null;
}

function scanArchive(a) {
  const { entries, via, error } = list(a.path);
  const scenes = entries.filter((e) => e.path.toLowerCase().endsWith('.max') && !BACKUP.test(e.path));
  const result = { records: [], alreadyUnzipped: [], error: scenes.length ? null : error, failed: [] };
  if (!scenes.length) return result;
  const others = [...new Set(entries.filter((e) => !scenes.includes(e)).map((e) => basename(e.path).toLowerCase()))];

  for (const e of scenes) {
    const name = basename(e.path);
    const onDisk = loose.get(`${name.toLowerCase()}|${e.size}`);
    if (onDisk) {
      result.alreadyUnzipped.push({ archive: a.path, entry: e.path, loosePath: onDisk });
      continue;
    }
    const virtualPath = join(a.path, ...e.path.split('/'));
    const id = idFor(virtualPath);
    try {
      const tmp = extract(a.path, e, via);
      if (!tmp) throw new Error(error || 'could not extract');
      const { thumbnail, ...info } = readMaxInfo(tmp);
      const png = thumbnailPng(thumbnail);
      if (png) writeFileSync(join(thumbDir, `${id}.png`), png);
      result.records.push({
        id,
        path: virtualPath,
        name,
        folder: a.folder,
        size: e.size,
        modified: a.modified,
        archive: a.path,
        entry: e.path,
        archiveFiles: others,
        ...info,
        thumbnail: png ? `thumbs/${id}.png` : null,
      });
    } catch (err) {
      result.failed.push({ archive: a.path, entry: e.path, error: err.message });
    }
  }
  rmSync(tmpDir, { recursive: true, force: true });
  return result;
}

const t0 = Date.now();
const out = { records: [], alreadyUnzipped: [], failed: [], unreadable: [] };
archives.forEach((a, n) => {
  const key = `${a.path}|${a.size}|${a.modified}`;
  let r = cache[key];
  if (!r) {
    process.stdout.write(`  [${n + 1}/${archives.length}] ${a.name} (${Math.round(a.size / 2 ** 20)} MB)`.padEnd(100).slice(0, 100) + '\r');
    r = scanArchive(a);
    if (!r.error && !r.failed.length) {
      cache[key] = r; // archives that failed are tried again next run
      writeFileSync(cachePath, JSON.stringify(cache));
    }
  }
  out.records.push(...r.records);
  out.alreadyUnzipped.push(...r.alreadyUnzipped);
  out.failed.push(...r.failed);
  if (r.error) out.unreadable.push({ archive: a.path, error: r.error });
});
process.stdout.write(' '.repeat(100) + '\r');

const seconds = ((Date.now() - t0) / 1000).toFixed(1);
const { records, ...rest } = out;
writeFileSync(
  join(outDir, 'archive-metadata.json'),
  JSON.stringify({ readAt: new Date().toISOString(), seconds, archivesChecked: archives.length, files: records, ...rest }, null, 2),
);

const withScenes = new Set([...records, ...out.alreadyUnzipped].map((x) => x.archive));
console.log(`Checked ${archives.length} archives in ${seconds}s. ${withScenes.size} contain .max files.`);
console.log(`Read from inside archives: ${records.length}   Already unzipped on disk: ${out.alreadyUnzipped.length}   Could not read: ${out.failed.length}`);
console.log(`Archives tar could not open: ${out.unreadable.length}`);
for (const f of out.failed) console.log(`  failed: ${f.archive} > ${f.entry} (${f.error})`);
