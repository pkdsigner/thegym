// "Send to Max": prepares a stand on this side (archive unpacked to a cache, textures copied into the 3ds Max
// project) and asks the listener inside 3ds Max (max-tools/standvault_max.py) to merge it and relink the copies.
// Original scenes and textures are only ever read.
import { existsSync, readFileSync, statSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join, basename, extname, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dbFolder, loadSettings } from './db.js';

const LISTENER_FILE = join(process.env.LOCALAPPDATA || '', 'StandVault', 'max-listener.json');
const MAX_YEAR = () => Number(loadSettings().maxVersion) || 2026;

export class MaxError extends Error {
  constructor(message, code = 'MAX') {
    super(message);
    this.code = code;
  }
}

const STARTUP_SCRIPT = join(process.env.LOCALAPPDATA || '', 'Autodesk', '3dsMax', '2026 - 64bit', 'ENU', 'scripts', 'startup', 'StandVault_startup.ms');
const MAX_TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'max-tools');

// Says which of the usual reasons it is: tools not installed, 3ds Max closed, or the listener switched off.
function notListening() {
  if (!existsSync(STARTUP_SCRIPT))
    return `The StandVault tools aren't installed in 3ds Max yet. Open 3ds Max and drag install.ms from ${MAX_TOOLS} onto a viewport, then try again.`;
  const running = spawnSync('tasklist', ['/FI', 'IMAGENAME eq 3dsmax.exe', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout || '';
  if (!/3dsmax\.exe/i.test(running)) return '3ds Max is not open. Start 3ds Max (the StandVault tools load with it), then try again.';
  return "3ds Max is open but not listening. In 3ds Max choose StandVault > Start listener, then try again.";
}

async function maxCall(path, body) {
  if (!existsSync(LISTENER_FILE)) throw new MaxError(notListening(), 'MAX_OFF');
  const { port, token } = JSON.parse(readFileSync(LISTENER_FILE, 'utf8'));
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-StandVault-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(body ? 60 * 60 * 1000 : 5 * 60 * 1000), // merging a big stand can take a while
    });
  } catch {
    throw new MaxError(notListening(), 'MAX_OFF');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new MaxError(`3ds Max: ${data.error || res.statusText}`);
  return data;
}

// ---- Scenes inside archives are unpacked once into <library>/cache/archives/<hash> ----

function unpackArchive(archive) {
  const dir = join(dbFolder(), '..', 'cache', 'archives', createHash('sha1').update(archive.toLowerCase()).digest('hex').slice(0, 16));
  const done = join(dir, '.unpacked');
  if (existsSync(done)) return dir;
  mkdirSync(dir, { recursive: true });
  let r = spawnSync('tar', ['-xf', archive, '-C', dir], { windowsHide: true, encoding: 'utf8' });
  if (r.status !== 0 && /\.zip$/i.test(archive)) {
    // Zips with file names tar can't read: Windows' own zip support.
    r = spawnSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:SV_ZIP, $env:SV_OUT)'],
      { windowsHide: true, encoding: 'utf8', env: { ...process.env, SV_ZIP: archive, SV_OUT: dir } },
    );
  }
  if (r.status !== 0) throw new MaxError(`Could not unpack ${basename(archive)}: ${(r.stderr || '').trim().split('\n').pop()}`);
  writeFileSync(done, new Date().toISOString());
  return dir;
}

function filesByName(dir) {
  const map = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (!map.has(e.name.toLowerCase())) map.set(e.name.toLowerCase(), p);
    }
  };
  walk(dir);
  return map;
}

const safeFolder = (s) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80);

// Shared by stands and library assets: copy the textures into <project>\maps\<layer>\ (two different files with
// the same name both survive, nothing is overwritten), check the renderer, then ask 3ds Max to merge and relink.
// files: [{ original: path as saved in the scene, source: a file to copy, or null when missing }]
async function mergeIntoMax({ maxPath, layer, files, renderer, savedAsYear, what }) {
  if (savedAsYear && savedAsYear > MAX_YEAR()) throw new MaxError(`${basename(maxPath)} was saved by 3ds Max ${savedAsYear}; your 3ds Max ${MAX_YEAR()} can't open it.`);
  if (!existsSync(maxPath)) throw new MaxError(`The scene file is no longer there: ${maxPath}`);
  const status = await maxCall('/status');

  const mapsDir = join(status.mapsRoot, 'maps', safeFolder(layer));
  mkdirSync(mapsDir, { recursive: true });
  const used = new Map(); // target name -> source
  const originals = [];
  const targets = [];
  let copied = 0;
  let reused = 0;
  let missing = 0;
  for (const f of files) {
    if (!f.source || !existsSync(f.source)) {
      missing++;
      continue;
    }
    let name = basename(f.source);
    for (let i = 2; used.has(name.toLowerCase()) && used.get(name.toLowerCase()) !== f.source.toLowerCase(); i++) {
      name = `${basename(f.source, extname(f.source))}_${i}${extname(f.source)}`;
    }
    used.set(name.toLowerCase(), f.source.toLowerCase());
    const target = join(mapsDir, name);
    if (existsSync(target) && statSync(target).size === statSync(f.source).size) reused++;
    else {
      await copyFile(f.source, target);
      copied++;
    }
    originals.push(f.original);
    targets.push(target);
  }

  // The renderer must be installed, and ideally match the open scene.
  const warnings = [];
  const has = (re) => status.renderers.some((r) => re.test(r));
  if (renderer === 'VRay' && !has(/v_?ray/i))
    warnings.push(`This ${what} was made with V-Ray, which isn't installed in this 3ds Max: its V-Ray materials come in as missing. Open or convert it on a PC with V-Ray.`);
  else if (renderer === 'VRay' && !/v_?ray/i.test(status.renderer))
    warnings.push(`This ${what} uses V-Ray materials but your scene renders with ${status.renderer}. Run the Corona Converter to convert them.`);
  else if (renderer === 'Corona' && !/corona/i.test(status.renderer))
    warnings.push(`This ${what} uses Corona materials but your scene renders with ${status.renderer}. Convert them with your converter of choice.`);

  const merged = await maxCall('/merge', { maxPath, layer, originals, targets, copied, reused, missing, mapsDir, warnings });
  return { ...merged, layer, copied, reused, missing, mapsDir, warnings, placement: status.placement, scene: status.scene };
}

export async function sendStand(db, standId) {
  const stand = db.prepare('SELECT * FROM stands WHERE id = ?').get(standId);
  if (!stand) throw new MaxError('Stand not found');
  const versions = db.prepare('SELECT * FROM source_files WHERE stand_id = ? ORDER BY modified DESC').all(standId);
  const version = versions.find((v) => v.file_id === stand.best_file_id) || versions[0];
  if (!version) throw new MaxError('This stand has no scene file.');
  if (version.saved_as_year && version.saved_as_year > MAX_YEAR())
    throw new MaxError(`${version.name} was saved by 3ds Max ${version.saved_as_year}; your 3ds Max ${MAX_YEAR()} can't open it.`);

  // The scene file to merge: the original, or its unpacked copy when it lives inside an archive.
  let maxPath = version.path;
  let unpacked = null;
  if (version.archive) {
    const dir = unpackArchive(version.archive);
    unpacked = filesByName(dir);
    maxPath = join(dir, version.path.slice(version.archive.length + 1));
    if (!existsSync(maxPath)) maxPath = unpacked.get(version.name.toLowerCase()) || maxPath;
  }

  // Where each texture can be copied from: where the scene expects it, a copy beside the scene, or inside an archive.
  const files = db
    .prepare('SELECT path, status, found_at FROM textures WHERE file_id = ?')
    .all(version.file_id)
    .map((t) => {
      let source = null;
      if (t.status === 'ok') source = isAbsolute(t.path) && /^([a-z]:|\\\\)/i.test(t.path) ? t.path : join(version.folder, t.path);
      else if (t.found_at && /\.(zip|rar|7z)$/i.test(t.found_at)) source = (unpacked || filesByName(unpackArchive(t.found_at))).get(basename(t.path).toLowerCase());
      else if (t.found_at) source = t.found_at;
      return { original: t.path, source };
    });

  const layer = stand.asset_id || `SV_${safeFolder(stand.title || stand.id)}`;
  const result = await mergeIntoMax({ maxPath, layer, files, renderer: version.renderer, savedAsYear: version.saved_as_year, what: 'stand' });
  logUse(db, 'stands', 'id', standId, result.scene);
  return { ...result, version: version.name };
}

// A library asset: its package already holds its .max and maps\; those copies are what its materials point at.
export async function sendAsset(db, assetId) {
  const asset = db.prepare('SELECT * FROM assets WHERE asset_id = ?').get(assetId);
  if (!asset) throw new MaxError('Asset not found');
  if (asset.status !== 'ready') throw new MaxError('This asset is still being saved.');
  const mapsFolder = join(asset.package_path, 'maps');
  const files = existsSync(mapsFolder)
    ? readdirSync(mapsFolder, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => ({ original: join(mapsFolder, e.name), source: join(mapsFolder, e.name) }))
    : [];
  const result = await mergeIntoMax({ maxPath: asset.max_path, layer: asset.asset_id, files, renderer: asset.renderer, what: 'asset' });
  logUse(db, 'assets', 'asset_id', assetId, result.scene);
  return result;
}

function logUse(db, table, key, id, scene) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE ${table} SET used_count = used_count + 1, updated_at = ? WHERE ${key} = ?`).run(now, id);
  if (table === 'stands') db.prepare('INSERT INTO usage_log (stand_id, project_name, scene_path, sent_at) VALUES (?, ?, ?, ?)').run(id, scene ? basename(scene) : null, scene, now);
}
