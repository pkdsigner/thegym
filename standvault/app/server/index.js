// StandVault local server: the API the web app talks to. Listens on this computer only (127.0.0.1).
import express from 'express';
import { existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { openDb, transaction, refreshSearch, isAllowedPath, dbFolder, loadSettings, projectRoot, readTaxonomy } from './db.js';
import { buildAssetId, validateAssetId, formatSize, toCamel } from '../../config/naming.js';
import { backupNow, lastBackup } from './backup.js';
import { sendStand } from './max.js';
import { libraryRoutes } from './library.js';

const PORT = Number(process.env.PORT) || 5174;
const here = dirname(fileURLToPath(import.meta.url));
const db = openDb();
const app = express();
app.use(express.json({ limit: '1mb' }));

const now = () => new Date().toISOString();
const bad = (res, message, code = 400) => res.status(code).json({ error: message });

// ---- Stands ----

// The picture shown for a stand: the one the user picked, else the best render, else Max's thumbnail.
const PREVIEW_SQL = `COALESCE(s.preview_path,
  (SELECT r.path FROM renders r WHERE r.stand_id = s.id ORDER BY r.position LIMIT 1), s.scan_thumbnail)`;

const CARD_COLUMNS = `s.id, s.asset_id, s.status, s.title, s.client, s.show, s.year, s.width, s.depth, s.area, s.size_source,
  s.open_sides, s.project_type, s.venue, s.setting, s.favourite, s.used_count, s.scan_renderer AS renderer, s.scan_versions AS versions,
  s.scan_preview AS preview_source, s.scan_textures_missing AS textures_missing, s.scan_textures_total AS textures_total,
  s.scan_last_modified AS last_modified, ${PREVIEW_SQL} AS preview`;

const SORTS = {
  newest: 's.scan_last_modified DESC',
  oldest: 's.scan_last_modified ASC',
  small: 's.area IS NULL, s.area ASC',
  large: 's.area IS NULL, s.area DESC',
  used: 's.used_count DESC, s.scan_last_modified DESC',
  favourites: 's.favourite DESC, s.scan_last_modified DESC',
  name: 'COALESCE(s.asset_id, s.title) COLLATE NOCASE',
};

// Turns what the user typed into an FTS5 query: every word must match, as a prefix ("gite" finds GITEX).
const ftsQuery = (q) =>
  q
    .split(/\s+/)
    .map((w) => w.replace(/["*^():]/g, ''))
    .filter(Boolean)
    .map((w) => `"${w}"*`)
    .join(' ');

app.get('/api/stands', (req, res) => {
  const q = req.query;
  const where = [];
  const params = {};
  if (q.status && q.status !== 'all') (where.push('s.status = :status'), (params.status = q.status));
  else where.push("s.status != 'not_stand'");
  if (q.q?.trim()) {
    where.push('s.id IN (SELECT stand_id FROM stands_fts WHERE stands_fts MATCH :fts)');
    params.fts = ftsQuery(q.q);
  }
  // Exact size, either way round, with a tolerance in metres.
  if (q.w && q.d) {
    const tol = Number(q.tol ?? 1);
    where.push(`((ABS(s.width - :w) <= :tol AND ABS(s.depth - :d) <= :tol) OR (ABS(s.width - :d) <= :tol AND ABS(s.depth - :w) <= :tol))`);
    Object.assign(params, { w: Number(q.w), d: Number(q.d), tol });
  }
  if (q.minArea) (where.push('s.area >= :minArea'), (params.minArea = Number(q.minArea)));
  if (q.maxArea) (where.push('s.area < :maxArea'), (params.maxArea = Number(q.maxArea)));
  if (q.noSize === '1') where.push('s.area IS NULL');
  if (q.show) (where.push('s.show = :show'), (params.show = q.show));
  if (q.year) (where.push('s.year = :year'), (params.year = Number(q.year)));
  if (q.renderer) (where.push('s.scan_renderer = :renderer'), (params.renderer = q.renderer));
  if (q.venue) (where.push('s.venue = :venue'), (params.venue = q.venue));
  if (q.projectType) (where.push('s.project_type = :projectType'), (params.projectType = q.projectType));
  for (const kind of ['style', 'spatial', 'functional', 'look', 'eventCategory', 'eventElement']) {
    if (!q[kind]) continue;
    where.push(`s.id IN (SELECT stand_id FROM stand_labels WHERE kind = '${kind}' AND value = :${kind})`);
    params[kind] = q[kind];
  }
  if (q.openSides) (where.push('s.open_sides = :openSides'), (params.openSides = q.openSides));
  if (q.favourites === '1') where.push('s.favourite = 1');
  if (q.missing === '1') where.push('s.scan_textures_missing > 0');
  if (q.noPreview === '1') where.push(`${PREVIEW_SQL} IS NULL`);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pageSize = Math.min(200, Number(q.pageSize) || 60);
  const page = Math.max(0, Number(q.page) || 0);
  try {
    const total = db.prepare(`SELECT COUNT(*) n FROM stands s ${whereSql}`).get(params).n;
    const items = db
      .prepare(`SELECT ${CARD_COLUMNS} FROM stands s ${whereSql} ORDER BY ${SORTS[q.sort] || SORTS.newest} LIMIT ${pageSize} OFFSET ${page * pageSize}`)
      .all(params);
    res.json({ total, page, pageSize, items });
  } catch (e) {
    bad(res, e.message);
  }
});

function standDetail(id) {
  const s = db.prepare(`SELECT s.*, ${PREVIEW_SQL} AS preview FROM stands s WHERE s.id = ?`).get(id);
  if (!s) return null;
  const versions = db
    .prepare(
      `SELECT file_id, path, name, folder, archive, size_bytes, modified, saved_as_year, renderer, objects, faces, materials,
        default_name_pct, textures_total, textures_missing, preview_source, thumbnail FROM source_files
       WHERE stand_id = ? ORDER BY modified DESC`,
    )
    .all(id);
  const renders = db.prepare('SELECT path FROM renders WHERE stand_id = ? ORDER BY position').all(id).map((r) => r.path);
  const tags = db.prepare('SELECT tag FROM stand_tags WHERE stand_id = ? ORDER BY tag').all(id).map((t) => t.tag);
  const labels = Object.fromEntries(LABEL_KINDS.map((k) => [k, []]));
  for (const l of db.prepare('SELECT kind, value FROM stand_labels WHERE stand_id = ?').all(id)) labels[l.kind]?.push(l.value);
  const best = versions.find((v) => v.file_id === s.best_file_id) || versions[0];
  const textures = best
    ? db
        .prepare(
          `SELECT path, status, reason, found_at FROM textures WHERE file_id = ?
           ORDER BY CASE status WHEN 'missing' THEN 0 WHEN 'elsewhere' THEN 1 WHEN 'nearby' THEN 2 ELSE 3 END LIMIT 600`,
        )
        .all(best.file_id)
    : [];
  const shortlists = db.prepare('SELECT shortlist_id FROM shortlist_items WHERE stand_id = ?').all(id).map((r) => r.shortlist_id);
  return { ...s, versions, renders, tags, labels, textures, textureFileId: best?.file_id ?? null, shortlists };
}

app.get('/api/stands/:id', (req, res) => {
  const s = standDetail(req.params.id);
  s ? res.json(s) : bad(res, 'Stand not found', 404);
});

const EDITABLE = ['title', 'client', 'show', 'year', 'width', 'depth', 'open_sides', 'project_type', 'venue', 'setting', 'notes', 'favourite', 'best_file_id', 'preview_path'];
const LABEL_KINDS = ['style', 'spatial', 'functional', 'look', 'eventCategory', 'eventElement'];

// The Asset ID a stand would get, and whether it passes the naming rules. Projects that aren't at a show
// (activation, event, kiosk...) use their type in the show's place: ST_9x4p5_Activation2026_Ford_0012.
function proposedId(s, number) {
  const tax = readTaxonomy();
  const type = tax.projectTypes.find((t) => t.code === s.project_type);
  const showWord = s.show || type?.nameWord;
  const fail = (msg) => ({ id: null, check: { valid: false, errors: [msg], warnings: [] } });
  // Events often have no footprint: their setting (Indoor / Outdoor) stands in for the size.
  const hasSize = s.width && s.depth;
  const isEvent = s.project_type === 'Event';
  if (!hasSize && !(isEvent && s.setting)) return fail(isEvent ? 'Choose indoor or outdoor (or enter a size).' : 'The size (width x depth) is needed.');
  if (!showWord) return fail('The show is needed for an exhibition stand (or choose another project type).');
  if (!s.client) return fail('The client is needed.');
  const id = buildAssetId(
    { level: 'ST', size: hasSize ? formatSize(s.width, s.depth) : s.setting, show: `${showWord}${s.year ?? ''}`, client: s.client, number: number ?? 1 },
    tax,
  );
  return { id, check: validateAssetId(id, tax) };
}

app.patch('/api/stands/:id', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM stands WHERE id = ?').get(id);
  if (!current) return bad(res, 'Stand not found', 404);
  const body = req.body || {};
  const patch = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k] === '' ? null : body[k];
  if ('notes' in patch) patch.notes = patch.notes ?? ''; // notes are never empty-as-null in the database
  if ('width' in patch || 'depth' in patch) {
    for (const k of ['width', 'depth']) if (k in patch && patch[k] != null) patch[k] = Math.round(Number(patch[k]) * 10) / 10;
    const w = patch.width ?? current.width;
    const d = patch.depth ?? current.depth;
    patch.area = w && d ? Math.round(w * d * 10) / 10 : null;
    patch.size_source = 'user';
  }
  if ('year' in patch && patch.year != null) patch.year = Number(patch.year);
  if ('favourite' in patch) patch.favourite = patch.favourite ? 1 : 0;
  const merged = { ...current, ...patch };

  try {
    transaction(db, () => {
      // Status changes: approving gives the stand its running number and Asset ID.
      if (body.status === 'approved') {
        const number = current.number ?? (db.prepare('SELECT COALESCE(MAX(number), 0) + 1 n FROM stands').get().n);
        const { id: assetId, check } = proposedId(merged, number);
        if (!check.valid) throw Object.assign(new Error(check.errors.join(' ')), { status: 422 });
        const clash = db.prepare('SELECT id FROM stands WHERE asset_id = ? AND id != ?').get(assetId, id);
        if (clash) throw Object.assign(new Error(`${assetId} is already used by another stand.`), { status: 422 });
        Object.assign(patch, { status: 'approved', number, asset_id: assetId, reviewed_at: now(), skipped_at: null });
        if (!current.type_confirmed_at) patch.type_confirmed_at = now();
      } else if (body.status === 'not_stand' || body.status === 'unreviewed') {
        Object.assign(patch, { status: body.status, reviewed_at: body.status === 'unreviewed' ? null : now() });
        if (body.status === 'unreviewed') Object.assign(patch, { asset_id: null });
      } else if (current.status === 'approved' && ['width', 'depth', 'setting', 'show', 'year', 'client', 'project_type'].some((k) => k in patch)) {
        // An approved stand keeps its number; its name follows the corrected details.
        const { id: assetId, check } = proposedId(merged, current.number);
        if (!check.valid) throw Object.assign(new Error(check.errors.join(' ')), { status: 422 });
        patch.asset_id = assetId;
      }
      if (body.skip) patch.skipped_at = now();
      // Choosing a project type yourself counts as sorting it.
      if ('project_type' in patch && patch.project_type !== current.project_type) patch.type_confirmed_at = now();
      const keys = Object.keys(patch);
      if (keys.length) {
        db.prepare(`UPDATE stands SET ${keys.map((k) => `${k} = :${k}`).join(', ')}, updated_at = :updated_at WHERE id = :id`).run({
          ...patch,
          updated_at: now(),
          id,
        });
      }
      if (Array.isArray(body.tags)) {
        db.prepare('DELETE FROM stand_tags WHERE stand_id = ?').run(id);
        const add = db.prepare('INSERT OR IGNORE INTO stand_tags (stand_id, tag) VALUES (?, ?)');
        for (const t of body.tags) if (String(t).trim()) add.run(id, String(t).trim().toLowerCase());
      }
      if (body.labels && typeof body.labels === 'object') {
        const add = db.prepare('INSERT OR IGNORE INTO stand_labels (stand_id, kind, value) VALUES (?, ?, ?)');
        for (const kind of LABEL_KINDS) {
          if (!Array.isArray(body.labels[kind])) continue;
          db.prepare('DELETE FROM stand_labels WHERE stand_id = ? AND kind = ?').run(id, kind);
          for (const v of body.labels[kind]) if (String(v).trim()) add.run(id, kind, String(v).trim());
        }
      }
      refreshSearch(db, id);
    });
    res.json(standDetail(id));
  } catch (e) {
    bad(res, e.message, e.status || 400);
  }
});

app.use('/api/library', libraryRoutes(db));

// Send to Max: merge the stand's chosen version into the scene open in 3ds Max (see server/max.js).
let sending = false;
app.post('/api/stands/:id/send', async (req, res) => {
  if (sending) return bad(res, 'Another stand is still being sent to 3ds Max. Wait for it to finish.', 409);
  sending = true;
  try {
    const result = await sendStand(db, req.params.id);
    refreshSearch(db, req.params.id);
    res.json(result);
  } catch (e) {
    bad(res, e.message, e.code === 'MAX_OFF' ? 503 : 400);
  } finally {
    sending = false;
  }
});

// Checks a would-be Asset ID without saving (live feedback in the edit form).
app.post('/api/stands/:id/check-name', (req, res) => {
  const current = db.prepare('SELECT * FROM stands WHERE id = ?').get(req.params.id);
  if (!current) return bad(res, 'Stand not found', 404);
  const merged = { ...current, ...req.body };
  const number = current.number ?? db.prepare('SELECT COALESCE(MAX(number), 0) + 1 n FROM stands').get().n;
  const { id, check } = proposedId(merged, number);
  const clash = id && db.prepare('SELECT id FROM stands WHERE asset_id = ? AND id != ?').get(id, current.id);
  res.json({ id, ...check, valid: check.valid && !clash, errors: clash ? [...check.errors, `${id} is already used.`] : check.errors });
});

// ---- Daily review ----

// ?type=Event limits the queue to one category (the detailed review is done category by category).
app.get('/api/review', (req, res) => {
  const count = Math.min(50, Number(req.query.count) || 10);
  const today = new Date().toISOString().slice(0, 10);
  const type = req.query.type || null;
  const typeSql = type ? 'AND s.project_type = :type' : '';
  const reviewedToday = db.prepare("SELECT COUNT(*) n FROM stands WHERE reviewed_at >= ?").get(today).n;
  const left = db.prepare(`SELECT COUNT(*) n FROM stands s WHERE s.status = 'unreviewed' ${typeSql}`).get(type ? { type } : {}).n;
  // Newest work first; skipped stands go to the back of the queue.
  const queue = db
    .prepare(
      `SELECT s.id FROM stands s WHERE s.status = 'unreviewed' ${typeSql}
       ORDER BY s.skipped_at IS NOT NULL, s.skipped_at, s.scan_last_modified DESC LIMIT :count`,
    )
    .all({ count, ...(type ? { type } : {}) })
    .map((r) => r.id);
  res.json({ reviewedToday, left, queue });
});

// ---- Quick sort: confirm each project's category before the detailed review ----

const UNSORTED = "s.type_confirmed_at IS NULL AND s.status != 'not_stand'";

app.get('/api/sort', (req, res) => {
  const count = Math.min(60, Number(req.query.count) || 24);
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    left: db.prepare(`SELECT COUNT(*) n FROM stands s WHERE ${UNSORTED}`).get().n,
    sortedToday: db.prepare("SELECT COUNT(*) n FROM stands WHERE type_confirmed_at >= ?").get(today).n,
    items: db.prepare(`SELECT ${CARD_COLUMNS}, s.scan_project FROM stands s WHERE ${UNSORTED} ORDER BY s.scan_last_modified DESC LIMIT ?`).all(count),
  });
});

// changes: [{ id, project_type }] or [{ id, notProject: true }]. Returns what was there before, for Undo.
app.post('/api/sort', (req, res) => {
  const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
  const types = readTaxonomy().projectTypes.map((t) => t.code);
  const before = db.prepare('SELECT id, project_type, status, type_confirmed_at, reviewed_at FROM stands WHERE id = ?');
  try {
    const previous = transaction(db, () =>
      changes.map((c) => {
        const was = before.get(String(c.id));
        if (!was) throw Object.assign(new Error(`Stand not found: ${c.id}`), { status: 404 });
        if (c.notProject) {
          db.prepare("UPDATE stands SET status = 'not_stand', reviewed_at = ?, type_confirmed_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), now(), was.id);
        } else {
          if (!types.includes(c.project_type)) throw Object.assign(new Error(`Unknown project type: ${c.project_type}`), { status: 400 });
          db.prepare('UPDATE stands SET project_type = ?, type_confirmed_at = ?, updated_at = ? WHERE id = ?').run(c.project_type, now(), now(), was.id);
        }
        refreshSearch(db, was.id);
        return was;
      }),
    );
    res.json({ done: previous.length, previous });
  } catch (e) {
    bad(res, e.message, e.status || 400);
  }
});

app.post('/api/sort/undo', (req, res) => {
  const previous = Array.isArray(req.body?.previous) ? req.body.previous : [];
  transaction(db, () => {
    for (const p of previous) {
      db.prepare('UPDATE stands SET project_type = ?, status = ?, type_confirmed_at = ?, reviewed_at = ?, updated_at = ? WHERE id = ?').run(
        p.project_type,
        p.status,
        p.type_confirmed_at,
        p.reviewed_at,
        now(),
        p.id,
      );
      refreshSearch(db, p.id);
    }
  });
  res.json({ undone: previous.length });
});

// ---- Images: thumbnails are made once with sharp and cached in <library>/db/thumbs ----

const thumbDir = () => join(dbFolder(), 'thumbs');
const IMAGE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp']);

app.get('/api/image', async (req, res) => {
  const path = String(req.query.path || '');
  const width = Math.min(2000, Math.max(80, Number(req.query.w) || 400));
  if (!path || !isAllowedPath(path) || !IMAGE_TYPES.has(extname(path).toLowerCase())) return res.status(404).end();
  let st;
  try {
    st = statSync(path);
  } catch {
    return res.status(404).end();
  }
  const key = createHash('sha1').update(`${path.toLowerCase()}|${st.size}|${st.mtimeMs}|${width}`).digest('hex');
  const cached = join(thumbDir(), `${key}.jpg`);
  res.set('Cache-Control', 'private, max-age=604800');
  if (!existsSync(cached)) {
    try {
      mkdirSync(thumbDir(), { recursive: true });
      // unlimited: big TIFF renders with embedded Photoshop data exceed libvips' default safety limit
      await sharp(path, { failOn: 'none', unlimited: true })
        .resize({ width, height: Math.round(width * 0.75), fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#1a1a1e' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(cached);
    } catch {
      return res.status(415).end();
    }
  }
  res.sendFile(cached);
});

// ---- Open the folder in Windows Explorer (only for paths in the scan folders or the library) ----

app.post('/api/open-folder', (req, res) => {
  const path = String(req.body?.path || '');
  if (!path || !isAllowedPath(path)) return bad(res, 'That location is outside the library and scan folders.', 403);
  // A scene inside an archive: show the archive itself.
  const target = path.replace(/(\.(zip|rar|7z))\\.*$/i, '$1');
  if (!existsSync(target)) return bad(res, 'That file is no longer there.', 404);
  // Explorer wants exactly /select,"<path>"; Node's own quoting of the whole argument breaks paths with spaces.
  spawn('explorer.exe', [`/select,"${target}"`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  res.json({ ok: true });
});

// ---- Shortlists ----

app.get('/api/shortlists', (_req, res) => {
  const lists = db.prepare('SELECT * FROM shortlists ORDER BY created_at DESC').all();
  const items = db.prepare(`SELECT i.shortlist_id, ${CARD_COLUMNS} FROM shortlist_items i JOIN stands s ON s.id = i.stand_id ORDER BY i.position`).all();
  res.json(lists.map((l) => ({ ...l, items: items.filter((i) => i.shortlist_id === l.id) })));
});
app.post('/api/shortlists', (req, res) => {
  const name = String(req.body?.name || '').trim() || 'Untitled shortlist';
  const r = db.prepare('INSERT INTO shortlists (name, created_at) VALUES (?, ?)').run(name, now());
  res.json({ id: Number(r.lastInsertRowid), name });
});
app.patch('/api/shortlists/:id', (req, res) => {
  db.prepare('UPDATE shortlists SET name = ? WHERE id = ?').run(String(req.body?.name || '').trim() || 'Untitled shortlist', Number(req.params.id));
  res.json({ ok: true });
});
app.delete('/api/shortlists/:id', (req, res) => {
  transaction(db, () => {
    db.prepare('DELETE FROM shortlist_items WHERE shortlist_id = ?').run(Number(req.params.id));
    db.prepare('DELETE FROM shortlists WHERE id = ?').run(Number(req.params.id));
  });
  res.json({ ok: true });
});
app.post('/api/shortlists/:id/items', (req, res) => {
  const listId = Number(req.params.id);
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 p FROM shortlist_items WHERE shortlist_id = ?').get(listId).p;
  db.prepare('INSERT OR IGNORE INTO shortlist_items (shortlist_id, stand_id, position) VALUES (?, ?, ?)').run(listId, String(req.body?.standId), pos);
  res.json({ ok: true });
});
app.delete('/api/shortlists/:id/items/:standId', (req, res) => {
  db.prepare('DELETE FROM shortlist_items WHERE shortlist_id = ? AND stand_id = ?').run(Number(req.params.id), req.params.standId);
  res.json({ ok: true });
});

// ---- Health check, stats, settings ----

app.get('/api/health', (_req, res) => {
  const list = (where, order = 's.scan_last_modified DESC') =>
    db.prepare(`SELECT ${CARD_COLUMNS} FROM stands s WHERE s.status != 'not_stand' AND ${where} ORDER BY ${order} LIMIT 500`).all();
  res.json({
    noSize: list('s.area IS NULL'),
    missing: list('s.scan_textures_missing > 0', 's.scan_textures_missing DESC'),
    noPreview: list(`${PREVIEW_SQL} IS NULL`),
    thumbnailOnly: list("s.scan_preview = 'thumbnail' AND s.preview_path IS NULL"),
    duplicates: db
      .prepare(
        `SELECT f.path, f.name, f.size_bytes, f.duplicate_of FROM source_files f WHERE f.duplicate_of IS NOT NULL ORDER BY f.size_bytes DESC LIMIT 500`,
      )
      .all(),
  });
});

app.get('/api/stats', (_req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  res.json({
    stands: one("SELECT COUNT(*) n FROM stands WHERE status != 'not_stand'"),
    unreviewed: one("SELECT COUNT(*) n FROM stands WHERE status = 'unreviewed'"),
    approved: one("SELECT COUNT(*) n FROM stands WHERE status = 'approved'"),
    notStand: one("SELECT COUNT(*) n FROM stands WHERE status = 'not_stand'"),
    withSize: one("SELECT COUNT(*) n FROM stands WHERE area IS NOT NULL AND status != 'not_stand'"),
    files: one('SELECT COUNT(*) n FROM source_files'),
    unsortedFiles: one('SELECT COUNT(*) n FROM source_files WHERE stand_id IS NULL'),
    unsorted: one("SELECT COUNT(*) n FROM stands WHERE type_confirmed_at IS NULL AND status != 'not_stand'"),
    zones: one("SELECT COUNT(*) n FROM assets WHERE level = 'ZN' AND status = 'ready'"),
    objects: one("SELECT COUNT(*) n FROM assets WHERE level = 'OB' AND status = 'ready'"),
    shows: db.prepare("SELECT show, COUNT(*) n FROM stands WHERE show IS NOT NULL AND status != 'not_stand' GROUP BY show ORDER BY n DESC").all(),
    years: db.prepare("SELECT year, COUNT(*) n FROM stands WHERE year IS NOT NULL AND status != 'not_stand' GROUP BY year ORDER BY year DESC").all(),
    venues: db.prepare("SELECT venue, COUNT(*) n FROM stands WHERE venue IS NOT NULL AND status != 'not_stand' GROUP BY venue ORDER BY n DESC").all(),
    projectTypes: db.prepare("SELECT project_type, COUNT(*) n FROM stands WHERE project_type IS NOT NULL AND status != 'not_stand' GROUP BY project_type").all(),
    lastImport: db.prepare("SELECT value FROM meta WHERE key = 'last_import'").get()?.value ?? null,
    lastBackup: lastBackup(),
  });
});

app.get('/api/config', (_req, res) => {
  const s = loadSettings();
  res.json({ taxonomy: readTaxonomy(), libraryRoot: s.libraryRoot, scanFolders: s.scanFolders, excludeFolders: s.excludeFolders });
});

// Settings screen: add a show/theme/type to taxonomy.json, or change the scan folders in settings.json.
// The files keep their 2-space formatting; config/ is StandVault's own, never the user's originals.
const TAXONOMY_LISTS = ['shows', 'themes', 'zoneTypes', 'objectTypes'];
app.post('/api/taxonomy', (req, res) => {
  const { list } = req.body || {};
  const value = toCamel(String(req.body?.value || ''));
  if (!TAXONOMY_LISTS.includes(list) || !value) return bad(res, 'Give a list and a name.');
  const tax = readTaxonomy();
  if (tax[list].some((x) => x.toLowerCase() === value.toLowerCase())) return bad(res, `${value} is already in the list.`);
  tax[list].push(value);
  writeFileSync(join(projectRoot, 'config', 'taxonomy.json'), JSON.stringify(tax, null, 2) + '\n');
  res.json({ added: value, taxonomy: tax });
});
app.put('/api/settings', (req, res) => {
  const folders = req.body?.scanFolders;
  if (!Array.isArray(folders) || folders.some((f) => typeof f !== 'string' || !/^[a-z]:\\/i.test(f.trim()))) return bad(res, 'Folders must be full paths like E:\\Projects.');
  const s = loadSettings();
  s.scanFolders = [...new Set(folders.map((f) => f.trim()))];
  writeFileSync(join(projectRoot, 'config', 'settings.json'), JSON.stringify(s, null, 2) + '\n');
  res.json({ scanFolders: s.scanFolders });
});

// ---- Backups: a dated copy of the database, at most once a day (also `npm run backup`) ----

function dailyBackup() {
  const today = `standvault-${new Date().toISOString().slice(0, 10)}.db`;
  if (lastBackup() !== today) console.log(`Backup: ${backupNow(db)}`);
}
dailyBackup();
setInterval(dailyBackup, 60 * 60 * 1000).unref();

// ---- The built web app (after `npm run build`); in development Vite serves it ----

const dist = join(here, '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, '127.0.0.1', () => console.log(`${new Date().toISOString()} StandVault server on http://127.0.0.1:${PORT}`));

// Log anything unexpected with a time stamp, then stop: Start StandVault.cmd restarts the server.
for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, (e) => {
    console.error(`${new Date().toISOString()} ${event}:`, e);
    process.exit(1);
  });
}
