// Step 2, last part: turn metadata.json into the inventory. Read-only; writes only to scanner/output.
// Checks textures, counts default object names, finds duplicates, matches renders, flags stands vs single assets,
// reads each stand's size/show/year/client from its names and groups a project's versions into one stand.
// Usage: npm run scan:inventory            (all files)
//        npm run scan:inventory -- --limit 10   (pilot: first 10 files, writes inventory-pilot.*)
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname, join, basename, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDefaultMaxName, loadTaxonomy } from '../config/naming.js';
import { makeStandReader } from './stand-details.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'output');
const settings = JSON.parse(readFileSync(join(here, '..', 'config', 'settings.json'), 'utf8'));
const maxYear = Number(settings.maxVersion);

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : null;
const pilot = Number.isFinite(limit) && limit > 0;

const meta = JSON.parse(readFileSync(join(outDir, 'metadata.json'), 'utf8'));
const archivePath = join(outDir, 'archive-metadata.json');
const archiveMeta = existsSync(archivePath)
  ? JSON.parse(readFileSync(archivePath, 'utf8'))
  : { files: [], alreadyUnzipped: [], unreadable: [], failed: [] };

// Files saved by a newer Max than the user's can't be opened, so they are left out of the inventory (counted only).
const newerMax = (r) => r.savedAsYear != null && r.savedAsYear > maxYear;
const everything = [...meta.files, ...archiveMeta.files];
const ignored = everything.filter(newerMax);
const all = everything.filter((r) => !newerMax(r));
const files = pilot ? all.slice(0, limit) : all;

// Loose files that also exist zipped (same name and size): note the archive instead of listing the scene twice.
const lower = (p) => p.toLowerCase();
const zippedCopies = new Map();
for (const z of archiveMeta.alreadyUnzipped) zippedCopies.set(lower(z.loosePath), [...(zippedCopies.get(lower(z.loosePath)) || []), z.archive]);
const t0 = Date.now();

// ---- 1. Index the scan folders once: every file by name (to relink textures) and images by folder (renders) ----

const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.exr']);
const byName = new Map(); // lowercase file name -> [path]
const imagesByDir = new Map(); // lowercase folder -> [{ path, size }]
const excluded = settings.excludeFolders.map((f) => lower(resolve(f)));

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!excluded.includes(lower(p))) walk(p);
      continue;
    }
    if (!ent.isFile()) continue;
    const key = lower(ent.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
    if (IMAGE.has(extname(key))) {
      let size = 0;
      try {
        size = statSync(p).size;
      } catch {}
      if (!imagesByDir.has(lower(dir))) imagesByDir.set(lower(dir), []);
      imagesByDir.get(lower(dir)).push({ path: p, size });
    }
  }
}
for (const root of settings.scanFolders) walk(resolve(root));
console.log(`Indexed ${byName.size} file names on the scan folders`);

// ---- 2. Textures and other external files ----

const existsCache = new Map();
const exists = (p) => {
  const k = lower(p);
  if (!existsCache.has(k)) existsCache.set(k, existsSync(p));
  return existsCache.get(k);
};
const shareCache = new Map();
const shareOnline = (p) => {
  const root = p.split('\\').slice(0, 4).join('\\'); // \\host\share
  if (!shareCache.has(lower(root))) shareCache.set(lower(root), existsSync(root));
  return shareCache.get(lower(root));
};

function whyMissing(p) {
  if (/chaos cosmos/i.test(p)) return 'Chaos Cosmos (download again)';
  if (p.startsWith('\\\\')) return 'network location not connected';
  const drive = p.match(/^([a-z]):/i);
  if (!drive) return 'no folder stored';
  if (!exists(`${drive[1]}:\\`)) return `drive ${drive[1].toUpperCase()}: not connected`;
  const user = p.match(/^c:\\users\\([^\\]+)/i);
  if (user && !exists(`C:\\Users\\${user[1]}`)) return 'from another computer';
  return 'not found';
}

// Same file name somewhere on the scan folders; prefer the one closest to the scene.
function findByName(p, sceneFolder) {
  const hits = byName.get(lower(basename(p.replace(/\//g, '\\'))));
  if (!hits) return null;
  const scene = lower(sceneFolder);
  const shared = (h) => {
    const a = lower(h);
    let i = 0;
    while (i < a.length && a[i] === scene[i]) i++;
    return i;
  };
  return hits.reduce((best, h) => (shared(h) > shared(best) ? h : best));
}

function checkTextures(r) {
  if (!r.assets) return null;
  const seen = new Set();
  const list = [];
  for (const a of r.assets) {
    if (a.type === 'RenderOutput' || !a.path) continue;
    const k = lower(a.path);
    if (seen.has(k)) continue;
    seen.add(k);
    const abs = isAbsolute(a.path) && /^([a-z]:|\\\\)/i.test(a.path) ? a.path : join(r.folder, a.path);
    const reachable = !abs.startsWith('\\\\') || shareOnline(abs);
    if (reachable && exists(abs)) {
      list.push({ type: a.type, path: a.path, status: 'ok' });
      continue;
    }
    // A scene read from inside an archive: textures packed in the same archive count as a copy beside it.
    if (r.archiveFiles?.includes(lower(basename(a.path.replace(/\//g, '\\'))))) {
      list.push({ type: a.type, path: a.path, status: 'nearby', reason: whyMissing(a.path), foundAt: r.archive });
      continue;
    }
    // 'nearby': a copy inside the scene's own folder (e.g. a Max Archive that recreated the original folders).
    // 'elsewhere': only a file with the same name somewhere else on the drive - probably the same texture.
    const foundAt = findByName(a.path, r.folder);
    const status = !foundAt ? 'missing' : lower(foundAt).startsWith(lower(r.folder) + '\\') ? 'nearby' : 'elsewhere';
    list.push({ type: a.type, path: a.path, status, reason: whyMissing(a.path), foundAt });
  }
  return list;
}

// ---- 3. Renders near each scene ----

const RENDER_DIR = /render|output|preview|image|jpg|final|view|shot|visual|presentation/i;
const TEXTURE_DIR = /^(maps?|textures?|tex|materials?|mtl|hdri?s?|sky|skies|assets|proxies|cosmos|bitmaps?|ies)$/i;
const TEXTURE_NAME =
  /(^|[\s_.-])(diff(use)?|albedo|base_?colou?r|col|normal|nrm|nor|bump|disp(lacement)?|height|refl(ection)?|gloss(iness)?|rough(ness)?|spec(ular)?|metal(lic|ness)?|opacity|alpha|mask|ao|occlusion|emissive|translucency|tile|seamless|pattern|texture)([\s_.-]|\d|$)/i;
const NOT_A_RENDER = /mood ?board|story ?board|slide|ref(erence)?s?\b|logo|brief|screenshot|whatsapp|capture|sketch|inspiration/i;
const MIN_RENDER_BYTES = 40 * 1024;
const tokens = (s) =>
  new Set(
    lower(s)
      .replace(/\.[^.]+$/, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !/^(v|op|r)?\d+$/.test(t) && !['3d', 'max', 'final', 'new', 'copy'].includes(t)),
  );
const versionTag = (s) => lower(s).match(/(?:^|[^a-z])(v|op|r)\s?0*(\d+)(?![a-z])/)?.slice(1).join('');

// Which scene folder(s) an image folder belongs to, and how render-like its position is:
//  - inside a scene folder: the folder itself (25), or a render-like sub-folder (40)
//  - beside one (Project\3d\scene.max + Project\Renders\...): the project folder itself (20) or a render-like sub-folder (30)
// A folder holding several projects' sub-folders (e.g. "3D DESIGNS") only claims images lying directly in it.
const maxDirs = new Set(all.map((r) => lower(r.folder)));
const scenesBelow = new Map(); // folder -> number of scene folders inside it
for (const d of maxDirs) for (let a = dirname(d); a !== dirname(a); a = dirname(a)) scenesBelow.set(a, (scenesBelow.get(a) || 0) + 1);
const isContainer = (d) => (scenesBelow.get(d) || 0) >= 2;
const childScenes = new Map();
for (const d of maxDirs) childScenes.set(dirname(d), [...(childScenes.get(dirname(d)) || []), d]);

function placeOf(dir) {
  const between = (base) => (dir === base ? [] : dir.slice(base.length + 1).split('\\'));
  const renderLike = (parts) => parts.length <= 4 && parts.some((p) => RENDER_DIR.test(p)) && !parts.some((p) => TEXTURE_DIR.test(p));
  for (let a = dir, up = 0; up <= 4; up++) {
    if (maxDirs.has(a)) {
      if (a === dir) return { owners: [a], place: isContainer(a) ? 15 : 25 };
      return !isContainer(a) && renderLike(between(a)) ? { owners: [a], place: 40 } : null;
    }
    const next = dirname(a);
    if (next === a) break;
    a = next;
  }
  for (let p = dir, up = 0; up <= 2; up++) {
    if (dirname(p) === p) return null; // never a drive root
    const kids = childScenes.get(p);
    if (kids) {
      if (kids.length > 2) return null;
      if (p === dir) return { owners: kids, place: 20 };
      return renderLike(between(p)) ? { owners: kids, place: 30 } : null;
    }
    p = dirname(p);
  }
  return null;
}

const imageDirsByScene = new Map(); // scene folder -> [{ dir, place }]
for (const dir of imagesByDir.keys()) {
  const at = placeOf(dir);
  for (const owner of at?.owners || []) imageDirsByScene.set(owner, [...(imageDirsByScene.get(owner) || []), { dir, place: at.place }]);
}

function findRenders(r, textureFiles) {
  const folder = lower(r.folder);
  const nameTokens = tokens(r.name);
  const nameVersion = versionTag(r.name);
  const outputs = new Set((r.assets || []).filter((a) => a.type === 'RenderOutput').map((a) => lower(basename(a.path))));
  const found = [];

  for (const { dir, place } of imageDirsByScene.get(folder) || []) {
    for (const img of imagesByDir.get(dir)) {
      const key = lower(img.path);
      if (img.size < MIN_RENDER_BYTES || textureFiles.has(key) || TEXTURE_NAME.test(basename(key))) continue;
      const imgTokens = tokens(basename(img.path));
      const common = [...nameTokens].filter((t) => imgTokens.has(t)).length;
      const union = new Set([...nameTokens, ...imgTokens]).size || 1;
      let score = place + (common / union) * 30 + Math.min(15, img.size / (150 * 1024));
      if (outputs.has(lower(basename(img.path)))) score += 60;
      if (nameVersion && versionTag(img.path.slice(folder.length)) === nameVersion) score += 10;
      if (NOT_A_RENDER.test(img.path.slice(dir.length))) score -= 25;
      if (score >= 32) found.push({ path: img.path, score: Math.round(score) });
    }
  }
  return found.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ---- 4. Duplicates: same size, then the same fingerprint (SHA-1 of the first and last 4 MB). Reading whole
// files would mean hundreds of GB across D: and E:; two different scenes of the exact same size that also match
// at both ends are, in practice, the same file. Fingerprints are cached so a re-run is quick ----

const cachePath = join(outDir, 'fingerprint-cache.json');
const hashCache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const CHUNK = 4 * 2 ** 20;
const hashFile = async (p) => {
  const fd = openSync(p, 'r');
  try {
    const size = statSync(p).size;
    const h = createHash('sha1');
    const read = (pos, len) => {
      const buf = Buffer.alloc(len);
      return buf.subarray(0, readSync(fd, buf, 0, len, pos));
    };
    h.update(read(0, Math.min(CHUNK, size)));
    if (size > CHUNK) h.update(read(Math.max(CHUNK, size - CHUNK), Math.min(CHUNK, size - CHUNK)));
    return h.digest('hex');
  } finally {
    closeSync(fd);
  }
};

async function findDuplicates(list) {
  const bySize = new Map();
  const byHash = new Map();
  for (const r of list) {
    // Scenes inside archives can't be hashed without unpacking again; same name and exact size counts as a copy.
    if (r.archive) {
      const key = `archived|${lower(r.name)}|${r.size}`;
      byHash.set(key, [...(byHash.get(key) || []), r]);
    } else bySize.set(r.size, [...(bySize.get(r.size) || []), r]);
  }
  const toHash = [...bySize.values()].filter((g) => g.length > 1).flat();
  let done = 0;
  for (const [i, r] of toHash.entries()) {
    const key = `${r.path}|${r.size}|${r.modified}`;
    if (!hashCache[key]) {
      try {
        hashCache[key] = await hashFile(r.path);
        if (++done % 100 === 0) writeFileSync(cachePath, JSON.stringify(hashCache));
      } catch {
        continue;
      }
    }
    process.stdout.write(`  Checking possible duplicates: ${i + 1}/${toHash.length}   \r`);
    byHash.set(hashCache[key], [...(byHash.get(hashCache[key]) || []), r]);
  }
  writeFileSync(cachePath, JSON.stringify(hashCache));
  const groups =[...byHash.values()].filter((g) => g.length > 1);
  groups.forEach((g, i) => {
    g.sort((a, b) => a.modified.localeCompare(b.modified));
    for (const r of g) {
      r.duplicateGroup = `D${i + 1}`;
      r.duplicateOf = r === g[0] ? null : g[0].path;
    }
  });
  return groups;
}

// ---- 5. Stand or single asset ----

// Where a file lives says more than its object count: these scenes merge whole furniture sets,
// so a library file can hold thousands of objects. Folder words are matched on whole folder names in the path.
const PROJECT_FOLDERS = /\\(projects|portfolio|exhibitions?|events|accounts|freelance( projects)?|3d designs|designs|op3 projects|ige|(19|20)\d{2})\\/i;
// Stand scenes are named like "Client @ Show", "OP 1", "Option 2" or carry the show name; parts are named "AC", "Chair".
const STAND_WORDS =
  /gitex|stand|booth|exhib|pavil|expo|adipec|idex|arab ?health|whx|gulfood|cityscape|wetex|satte|\batm\b|seamless|event|kiosk|summit|conference|festival|adihex|gisec|showroom|@|\bop ?\d|option/i;
const ASSET_FOLDERS =
  /\\[^\\]*(library|resources|3d models|furniture|assets?|templates?|set ?up|merge|xrefs?|learning|course|tutorial|lesson|training|practice)[^\\]*\\|\\(merg|pieces|mesh)\\/i;
const INBOX_FOLDER = /\\[^\\]*(inbox|desktop)[^\\]*\\/i; // unsorted downloads: says nothing either way
const MODELS_FOLDER = /\\models?\\/i; // in these projects stands often live in 3d\Models\<StandName>\, so only a mild hint
const REFERENCE_FOLDER = /\\[^\\]*ref+e+r+ences?[^\\]*\\|\\(reff?|reffer)\\/i; // also the "REFFERENCE" / "reff" spellings on E:

function classify(r) {
  const why = [];
  let score = 0;
  const objects = r.counts?.total ?? r.objects.length;
  const folder = dirname(r.path) + '\\'; // for a scene inside an archive this includes the folders inside it
  const ownName = basename(dirname(r.path)) + '\\' + r.name;
  if (PROJECT_FOLDERS.test(folder)) (score += 3), why.push('in a project folder');
  if (STAND_WORDS.test(ownName)) (score += 3), why.push('named like a stand/event');
  else if (STAND_WORDS.test(folder)) (score += 1), why.push('exhibition/event project');
  // The inbox lives inside the library; only folders below the inbox say anything about the file.
  const inbox = folder.match(INBOX_FOLDER);
  if (inbox) why.push('in the inbox (unsorted)');
  const assetFolder = (inbox ? folder.slice(inbox.index + inbox[0].length - 1) : folder).match(ASSET_FOLDERS);
  if (assetFolder) (score -= 4), why.push(`in a "${assetFolder[0].slice(1, -1).split('\\').pop()}" folder`);
  else if (MODELS_FOLDER.test(folder)) (score -= 2), why.push('in a "Models" folder');
  if (REFERENCE_FOLDER.test(folder)) (score -= 1), why.push('a reference scene');
  if (objects >= 300) (score += 1), why.push(`${objects} objects`);
  else if (objects < 50) (score -= 2), why.push(`only ${objects} objects`);
  if (r.size >= 100 * 2 ** 20) (score += 1), why.push('large file');
  if (r.renders.length) (score += 1), why.push('has renders');
  return { likely: score >= 4 ? 'full stand' : 'single asset', classReason: why.join(', ') };
}

// ---- Build ----

const readStand = makeStandReader(loadTaxonomy());
const textureFiles = new Set();
const inventory = files.map((src, n) => {
  const { assets, plugins, dependencies, hasSummary, ...r } = src;
  const textures = checkTextures(src);
  for (const t of textures || []) textureFiles.add(lower(t.foundAt || t.path));
  const defaults = r.objects.filter(isDefaultMaxName).length;
  process.stdout.write(`  Textures ${n + 1}/${files.length}   \r`);
  return {
    ...r,
    assets,
    textures,
    texturesTotal: textures ? textures.length : null,
    texturesMissing: textures ? textures.filter((t) => t.status === 'missing').length : null,
    texturesNearby: textures ? textures.filter((t) => t.status === 'nearby').length : null,
    texturesElsewhere: textures ? textures.filter((t) => t.status === 'elsewhere').length : null,
    defaultNames: defaults,
    defaultNamePct: r.objects.length ? Math.round((defaults / r.objects.length) * 100) : null,
    alsoZippedIn: zippedCopies.get(lower(r.path)) || [],
  };
});

for (const r of inventory) {
  r.renders = findRenders(r, textureFiles);
  r.preview = r.renders[0]?.path || (r.thumbnail ? join(outDir, r.thumbnail) : null);
  r.previewSource = r.renders.length ? 'render' : r.thumbnail ? 'thumbnail' : 'none';
  Object.assign(r, classify(r));
  r.stand = readStand(r);
  delete r.assets;
  delete r.archiveFiles;
}

const dupGroups = await findDuplicates(inventory);
process.stdout.write(' '.repeat(50) + '\r');

// ---- 6. Stands: one entry per project, its versions inside (newest first) ----

const standGroups = new Map();
for (const r of inventory) {
  if (r.likely !== 'full stand' || r.duplicateOf) continue;
  const key = r.stand.groupKey;
  if (!standGroups.has(key)) standGroups.set(key, []);
  standGroups.get(key).push(r);
}
const stands = [...standGroups.entries()].map(([key, versions]) => {
  versions.sort((a, b) => b.modified.localeCompare(a.modified));
  const latest = versions[0];
  const first = (f) => versions.map(f).find((v) => v != null) ?? null;
  const renders = [...new Map(versions.flatMap((v) => v.renders).map((x) => [lower(x.path), x])).values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const id = createHash('sha1').update(key).digest('hex').slice(0, 10);
  for (const v of versions) v.standId = id;
  return {
    id,
    title: latest.stand.title,
    client: first((v) => v.stand.client),
    show: first((v) => v.stand.show),
    year: first((v) => v.stand.year),
    size: first((v) => (v.stand.size?.width ? v.stand.size : null)) || first((v) => v.stand.size),
    suggestedId: first((v) => v.stand.suggestedId),
    renderer: latest.renderer,
    renderers: [...new Set(versions.map((v) => v.renderer).filter(Boolean))],
    previewSource: renders.length ? 'render' : versions.some((v) => v.thumbnail) ? 'thumbnail' : 'none',
    renders: renders.map((x) => x.path),
    thumbnail: first((v) => (v.thumbnail ? join(outDir, v.thumbnail) : null)),
    texturesMissing: latest.texturesMissing,
    texturesTotal: latest.texturesTotal,
    objects: latest.counts?.total ?? null,
    projectFolder: latest.stand.projectFolder,
    lastModified: latest.modified,
    versionCount: versions.length,
    versions: versions.map((v) => ({
      fileId: v.id,
      path: v.path,
      name: v.name,
      modified: v.modified,
      sizeBytes: v.size,
      savedAsYear: v.savedAsYear,
      renderer: v.renderer,
      objects: v.counts?.total ?? null,
      previewSource: v.previewSource,
      archive: v.archive || null,
    })),
  };
});
stands.sort((a, b) => b.lastModified.localeCompare(a.lastModified));

// Most worth harvesting: stands with renders, lots of content, recent, few missing textures. One per folder.
for (const r of inventory) {
  if (r.likely !== 'full stand' || r.duplicateOf) {
    r.harvestScore = 0;
    continue;
  }
  const missingShare = r.texturesTotal ? r.texturesMissing / r.texturesTotal : 0;
  r.harvestScore = Math.round(
    Math.min(r.renders.length, 3) * 10 +
      Math.log10((r.counts?.total || 1) + 1) * 8 +
      Math.max(0, (r.savedAsYear || 2010) - 2015) * 2 +
      (1 - missingShare) * 15 +
      (r.renderer === 'VRay' || r.renderer === 'Corona' ? 5 : 0),
  );
}
const bestPerFolder = new Map();
for (const r of inventory.filter((x) => x.harvestScore > 0)) {
  const cur = bestPerFolder.get(lower(r.folder));
  if (!cur || r.harvestScore > cur.harvestScore) bestPerFolder.set(lower(r.folder), r);
}
const top = [...bestPerFolder.values()].sort((a, b) => b.harvestScore - a.harvestScore).slice(0, 20);

// ---- Output ----

const suffix = pilot ? '-pilot' : '';
const seconds = ((Date.now() - t0) / 1000).toFixed(1);
writeFileSync(
  join(outDir, `inventory${suffix}.json`),
  JSON.stringify({ builtAt: new Date().toISOString(), seconds, maxVersion: maxYear, files: inventory, failed: meta.failed }, null, 2),
);

const COLUMNS = [
  ['id', (r) => r.id],
  ['File', (r) => r.name],
  ['Folder', (r) => r.folder],
  ['Likely', (r) => r.likely],
  ['Why', (r) => r.classReason],
  ['Stand id', (r) => r.standId],
  ['Stand size', (r) => (r.stand.size?.width ? `${r.stand.size.width} x ${r.stand.size.depth}` : r.stand.size ? `${r.stand.size.area} m2` : '')],
  ['Show', (r) => r.stand.show],
  ['Year', (r) => r.stand.year],
  ['Client', (r) => r.stand.client],
  ['Size MB', (r) => Math.round(r.size / 2 ** 20)],
  ['Modified', (r) => r.modified.slice(0, 10)],
  ['Saved for Max', (r) => r.savedAsYear],
  ['Renderer', (r) => r.renderer],
  ['Renderer name', (r) => r.rendererName],
  ['Objects', (r) => r.counts?.total],
  ['Default names %', (r) => r.defaultNamePct],
  ['Faces', (r) => r.counts?.faces],
  ['Materials', (r) => r.materials.length],
  ['Textures', (r) => r.texturesTotal],
  ['Missing textures', (r) => r.texturesMissing],
  ['Textures copied in scene folder', (r) => r.texturesNearby],
  ['Textures same name elsewhere', (r) => r.texturesElsewhere],
  ['Missing because', (r) => reasonSummary(r)],
  ['Preview', (r) => r.previewSource],
  ['Renders found', (r) => r.renders.length],
  ['Best render', (r) => r.renders[0]?.path],
  ['Thumbnail', (r) => (r.thumbnail ? join(outDir, r.thumbnail) : '')],
  ['Duplicate group', (r) => r.duplicateGroup],
  ['Duplicate of', (r) => r.duplicateOf],
  ['Harvest score', (r) => r.harvestScore || ''],
  ['Inside archive', (r) => r.archive],
  ['Also zipped in', (r) => r.alsoZippedIn.join('; ')],
  ['Full path', (r) => r.path],
];
function reasonSummary(r) {
  const counts = {};
  for (const t of r.textures || []) if (t.status === 'missing') counts[t.reason] = (counts[t.reason] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join('; ');
}
// Excel: UTF-8 BOM, CRLF, every text cell quoted; a leading = + - @ would be read as a formula, so prefix it.
const cell = (v) => {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(v);
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = [COLUMNS.map(([h]) => cell(h)), ...inventory.map((r) => COLUMNS.map(([, f]) => cell(f(r))))].map((row) => row.join(',')).join('\r\n');
writeFileSync(join(outDir, `inventory${suffix}.csv`), '\ufeff' + csv + '\r\n');

writeFileSync(join(outDir, `stands${suffix}.json`), JSON.stringify({ builtAt: new Date().toISOString(), stands }, null, 2));
const STAND_COLUMNS = [
  ['Stand id', (s) => s.id],
  ['Title', (s) => s.title],
  ['Client', (s) => s.client],
  ['Show', (s) => s.show],
  ['Year', (s) => s.year],
  ['Width m', (s) => s.size?.width],
  ['Depth m', (s) => s.size?.depth],
  ['Area m2', (s) => s.size?.area],
  ['Size found in', (s) => s.size && `${s.size.source}: "${s.size.text}"`],
  ['Suggested ID', (s) => s.suggestedId],
  ['Versions', (s) => s.versionCount],
  ['Latest file', (s) => s.versions[0].name],
  ['Latest saved', (s) => s.lastModified.slice(0, 10)],
  ['Renderer', (s) => s.renderer],
  ['Preview', (s) => s.previewSource],
  ['Renders', (s) => s.renders.length],
  ['Missing textures (latest)', (s) => (s.texturesTotal != null ? `${s.texturesMissing} of ${s.texturesTotal}` : '')],
  ['Project folder', (s) => s.projectFolder],
];
const standCsv = [STAND_COLUMNS.map(([h]) => cell(h)), ...stands.map((s) => STAND_COLUMNS.map(([, f]) => cell(f(s))))]
  .map((row) => row.join(','))
  .join('\r\n');
writeFileSync(join(outDir, `stands${suffix}.csv`), '\ufeff' + standCsv + '\r\n');

// ---- Summary ----

const sum = (list, f) => list.reduce((s, r) => s + (f(r) || 0), 0);
const tally = (f) =>
  Object.entries(inventory.reduce((m, r) => ((m[f(r) ?? 'unknown'] = (m[f(r) ?? 'unknown'] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const allObjects = sum(inventory, (r) => r.objects.length);
const allDefaults = sum(inventory, (r) => r.defaultNames);
const reasonTotals = {};
for (const r of inventory) for (const t of r.textures || []) if (t.status === 'missing') reasonTotals[t.reason] = (reasonTotals[t.reason] || 0) + 1;

const lines = [];
const out = (s = '') => lines.push(s);
out(`# StandVault inventory${pilot ? ` (pilot, first ${files.length} files)` : ''}`);
out();
out(`Built ${new Date().toLocaleString('en-GB')} in ${seconds}s. Read-only: no original file was changed.`);
out();
out('| | |');
out('|---|---|');
out(`| Files | ${inventory.length} (${(sum(inventory, (r) => r.size) / 2 ** 30).toFixed(1)} GB unpacked) |`);
out(`| Of which inside .zip/.rar/.7z archives | ${inventory.filter((r) => r.archive).length} (another ${archiveMeta.alreadyUnzipped.length} zipped scenes are already unzipped on disk and listed once) |`);
const needs7zip = archiveMeta.unreadable.filter((u) => /7-Zip/.test(u.error));
if (needs7zip.length) out(`| Archives not checked (need 7-Zip) | ${needs7zip.length} |`);
if (ignored.length) out(`| Left out: saved by a newer Max than ${maxYear} | ${ignored.length} |`);
out(`| Likely full stands | ${inventory.filter((r) => r.likely === 'full stand').length} |`);
out(`| Likely single assets | ${inventory.filter((r) => r.likely === 'single asset').length} |`);
out(`| Renderer | ${tally((r) => r.renderer).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
out(`| Saved for Max | ${tally((r) => r.savedAsYear).sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([k, v]) => `${k}: ${v}`).join(', ')} |`);
out(`| Files with missing textures | ${inventory.filter((r) => r.texturesMissing > 0).length} |`);
out(`| Files with no preview at all | ${inventory.filter((r) => r.previewSource === 'none').length} (another ${inventory.filter((r) => r.previewSource === 'thumbnail').length} have only Max's small thumbnail) |`);
out(`| Duplicate groups | ${dupGroups.length} (${sum(dupGroups, (g) => g.length - 1)} extra copies, ${(sum(dupGroups, (g) => g[0].size * (g.length - 1)) / 2 ** 30).toFixed(1)} GB) |`);
out(`| Objects with default names | ${allObjects ? Math.round((allDefaults / allObjects) * 100) : 0}% (${allDefaults} of ${allObjects}) |`);
out();
out('## Stands');
out();
const pct = (n) => `${n} (${stands.length ? Math.round((n / stands.length) * 100) : 0}%)`;
out(`${stands.length} stand projects, from ${sum(stands, (s) => s.versionCount)} stand files (versions grouped together).`);
out();
out('| Read from the names | Stands |');
out('|---|---|');
out(`| Size (width x depth) | ${pct(stands.filter((s) => s.size?.width).length)} |`);
out(`| Only an area (e.g. 800 sqm) | ${stands.filter((s) => s.size && !s.size.width).length} |`);
out(`| Show | ${pct(stands.filter((s) => s.show).length)} |`);
out(`| Year | ${pct(stands.filter((s) => s.year).length)} |`);
out(`| Client | ${pct(stands.filter((s) => s.client).length)} |`);
out(`| Complete Asset ID suggested | ${pct(stands.filter((s) => s.suggestedId).length)} |`);
out(`| With renders | ${pct(stands.filter((s) => s.previewSource === 'render').length)} |`);
out(`| Max thumbnail only | ${stands.filter((s) => s.previewSource === 'thumbnail').length} |`);
out(`| Renderer | ${Object.entries(stands.reduce((m, s) => ((m[s.renderer ?? 'unknown'] = (m[s.renderer ?? 'unknown'] || 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
out();
out('## Missing textures');
out();
const texAll = sum(inventory, (r) => r.texturesTotal);
const texMissing = sum(inventory, (r) => r.texturesMissing);
const texNearby = sum(inventory, (r) => r.texturesNearby);
const texElsewhere = sum(inventory, (r) => r.texturesElsewhere);
out(`${texAll} texture/external file links checked (counted once per file):`);
out();
out('| | Links |');
out('|---|---|');
out(`| Found where the scene expects them | ${texAll - texMissing - texNearby - texElsewhere} |`);
out(`| Not at the saved path, but a copy is inside the scene's folder or archive (relink) | ${texNearby} |`);
out(`| Not at the saved path, a file with the same name is elsewhere on the drive (probably the same) | ${texElsewhere} |`);
out(`| Missing | ${texMissing} |`);
out();
out('| Why missing | Links |');
out('|---|---|');
for (const [k, v] of Object.entries(reasonTotals).sort((a, b) => b[1] - a[1])) out(`| ${k} | ${v} |`);
if (needs7zip.length) {
  out();
  out('## Archives not checked (Windows cannot read their file names; 7-Zip can)');
  out();
  for (const u of needs7zip) out(`- \`${u.archive}\``);
}
out();
out('## Most worth harvesting first');
out();
out('| # | File | Renders | Objects | Missing textures | Saved for | Renderer |');
out('|---|---|---|---|---|---|---|');
top.forEach((r, i) =>
  out(`| ${i + 1} | \`${r.path}\` | ${r.renders.length} | ${r.counts?.total ?? ''} | ${r.texturesMissing ?? '-'} of ${r.texturesTotal ?? '-'} | ${r.savedAsYear ?? '?'} | ${r.renderer ?? '?'} |`),
);
writeFileSync(join(outDir, `summary${suffix}.md`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
