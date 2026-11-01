// Library assets (zones and objects) harvested with "Save to Library" in 3ds Max.
// 3ds Max asks for a name and a package folder (reserve), saves the copy there, then reports back (done);
// the preview is rendered afterwards by a headless 3ds Max, so the user isn't kept waiting.
import { Router } from 'express';
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildAssetId, validateAssetId, shortId, toCamel } from '../../config/naming.js';
import { loadSettings, readTaxonomy, transaction } from './db.js';
import { sendAsset } from './max.js';

const here = dirname(fileURLToPath(import.meta.url));
const RENDER_SCRIPT = join(here, '..', '..', 'max-tools', 'render-preview.ms');
const now = () => new Date().toISOString();

export function libraryRoutes(db) {
  const r = Router();
  const bad = (res, message, code = 400) => res.status(code).json({ error: message });
  const nextNumber = (level) => db.prepare('SELECT COALESCE(MAX(number), 0) + 1 n FROM assets WHERE level = ?').get(level).n;

  // The Asset ID these details would get (with the next free number) and what the naming rules say about it.
  function proposed({ level, type, theme, descriptor }, number) {
    const tax = readTaxonomy();
    if (!['ZN', 'OB'].includes(level)) return { id: null, valid: false, errors: ['Choose Zone or Object.'], warnings: [] };
    const id = buildAssetId({ level, type, theme, descriptor: toCamel(descriptor || ''), number }, tax);
    return { id, ...validateAssetId(id, tax) };
  }

  r.post('/name', (req, res) => res.json(proposed(req.body || {}, nextNumber(req.body?.level))));

  // Gives the asset its number and package folder. 3ds Max then saves into it.
  r.post('/reserve', (req, res) => {
    const b = req.body || {};
    try {
      const out = transaction(db, () => {
        const number = nextNumber(b.level);
        const check = proposed(b, number);
        if (!check.valid) throw Object.assign(new Error(check.errors.join(' ')), { status: 422 });
        const tax = readTaxonomy();
        const levelDef = tax.levels.find((l) => l.code === b.level);
        const packageDir = join(loadSettings().libraryRoot, levelDef.folder, b.type, check.id);
        if (existsSync(packageDir) && readdirSync(packageDir).length) throw Object.assign(new Error(`${packageDir} already exists.`), { status: 409 });
        mkdirSync(join(packageDir, 'maps'), { recursive: true });
        const maxPath = join(packageDir, `${check.id}.max`);
        const stand = b.sourceScene && db.prepare('SELECT stand_id FROM source_files WHERE lower(path) = lower(?)').get(b.sourceScene);
        db.prepare(
          `INSERT INTO assets (asset_id, level, number, type, theme, descriptor, package_path, max_path, source_scene, source_stand_id,
             renderer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(check.id, b.level, number, b.type, b.theme, toCamel(b.descriptor), packageDir, maxPath, b.sourceScene ?? null, stand?.stand_id ?? null, b.renderer ?? null, now(), now());
        const addTag = db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?, ?)');
        for (const t of b.tags ?? []) if (String(t).trim()) addTag.run(check.id, String(t).trim().toLowerCase());
        return { assetId: check.id, shortId: shortId(check.id), packageDir, mapsDir: join(packageDir, 'maps'), maxPath };
      });
      res.json(out);
    } catch (e) {
      bad(res, e.message, e.status || 400);
    }
  });

  // 3ds Max saved the package: record it, write asset.json, start the preview render.
  r.post('/assets/:id/done', (req, res) => {
    const a = db.prepare('SELECT * FROM assets WHERE asset_id = ?').get(req.params.id);
    if (!a) return bad(res, 'Asset not found', 404);
    if (!existsSync(a.max_path)) return bad(res, `The package file wasn't saved: ${a.max_path}`);
    const b = req.body || {};
    db.prepare('UPDATE assets SET status = ?, objects = ?, textures_total = ?, textures_missing = ?, updated_at = ? WHERE asset_id = ?').run(
      'ready',
      b.objects ?? null,
      b.texturesTotal ?? null,
      b.texturesMissing ?? null,
      now(),
      a.asset_id,
    );
    writeAssetJson(a.asset_id);
    renderPreview(a.asset_id);
    res.json(detail(a.asset_id));
  });

  // Saving failed in 3ds Max: give the number back and remove the empty package.
  r.post('/assets/:id/failed', (req, res) => {
    const a = db.prepare("SELECT * FROM assets WHERE asset_id = ? AND status = 'saving'").get(req.params.id);
    if (!a) return bad(res, 'Asset not found', 404);
    db.prepare('DELETE FROM assets WHERE asset_id = ?').run(a.asset_id);
    rmSync(a.package_path, { recursive: true, force: true });
    res.json({ ok: true });
  });

  r.get('/assets', (req, res) => {
    const q = req.query;
    const where = ["a.status = 'ready'"];
    const params = {};
    if (q.level) (where.push('a.level = :level'), (params.level = q.level));
    if (q.type) (where.push('a.type = :type'), (params.type = q.type));
    if (q.theme) (where.push('a.theme = :theme'), (params.theme = q.theme));
    if (q.favourites === '1') where.push('a.favourite = 1');
    if (q.q?.trim()) {
      q.q
        .trim()
        .split(/\s+/)
        .forEach((w, i) => {
          where.push(`(a.asset_id || ' ' || a.type || ' ' || a.theme || ' ' || a.descriptor || ' ' || a.notes || ' ' ||
            COALESCE((SELECT group_concat(tag, ' ') FROM asset_tags t WHERE t.asset_id = a.asset_id), '')) LIKE :w${i}`);
          params[`w${i}`] = `%${w}%`;
        });
    }
    const items = db.prepare(`SELECT a.* FROM assets a WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC`).all(params);
    res.json({ total: items.length, items });
  });

  const detail = (id) => {
    const a = db.prepare('SELECT * FROM assets WHERE asset_id = ?').get(id);
    if (!a) return null;
    const tags = db.prepare('SELECT tag FROM asset_tags WHERE asset_id = ? ORDER BY tag').all(id).map((t) => t.tag);
    const stand = a.source_stand_id && db.prepare('SELECT id, title, asset_id FROM stands WHERE id = ?').get(a.source_stand_id);
    return { ...a, tags, sourceStand: stand || null };
  };
  r.get('/assets/:id', (req, res) => {
    const a = detail(req.params.id);
    a ? res.json(a) : bad(res, 'Asset not found', 404);
  });

  r.patch('/assets/:id', (req, res) => {
    const a = db.prepare('SELECT * FROM assets WHERE asset_id = ?').get(req.params.id);
    if (!a) return bad(res, 'Asset not found', 404);
    const b = req.body || {};
    if ('favourite' in b) db.prepare('UPDATE assets SET favourite = ?, updated_at = ? WHERE asset_id = ?').run(b.favourite ? 1 : 0, now(), a.asset_id);
    if ('notes' in b) db.prepare('UPDATE assets SET notes = ?, updated_at = ? WHERE asset_id = ?').run(String(b.notes ?? ''), now(), a.asset_id);
    if (Array.isArray(b.tags)) {
      db.prepare('DELETE FROM asset_tags WHERE asset_id = ?').run(a.asset_id);
      const add = db.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?, ?)');
      for (const t of b.tags) if (String(t).trim()) add.run(a.asset_id, String(t).trim().toLowerCase());
    }
    writeAssetJson(a.asset_id);
    res.json(detail(a.asset_id));
  });

  r.post('/assets/:id/preview', (req, res) => {
    const a = db.prepare("SELECT asset_id FROM assets WHERE asset_id = ? AND status = 'ready'").get(req.params.id);
    if (!a) return bad(res, 'Asset not found', 404);
    renderPreview(a.asset_id);
    res.json({ rendering: true });
  });

  r.post('/assets/:id/send', async (req, res) => {
    try {
      res.json(await sendAsset(db, req.params.id));
    } catch (e) {
      bad(res, e.message, e.code === 'MAX_OFF' ? 503 : 400);
    }
  });

  // ---- asset.json: everything about the asset, kept next to its .max ----
  function writeAssetJson(id) {
    const a = detail(id);
    const json = {
      assetId: a.asset_id,
      level: a.level,
      type: a.type,
      theme: a.theme,
      descriptor: a.descriptor,
      number: a.number,
      renderer: a.renderer,
      objects: a.objects,
      textures: { total: a.textures_total, missing: a.textures_missing },
      tags: a.tags,
      notes: a.notes,
      source: { scene: a.source_scene, stand: a.sourceStand?.asset_id || a.sourceStand?.title || null },
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    };
    writeFileSync(join(a.package_path, 'asset.json'), JSON.stringify(json, null, 2) + '\n');
  }

  // ---- Preview: a short render in a headless 3ds Max (one at a time) ----
  const queue = [];
  let rendering = false;
  function renderPreview(id) {
    if (process.env.STANDVAULT_NO_PREVIEW) return; // tests: never start 3ds Max
    if (!queue.includes(id)) queue.push(id);
    if (!rendering) nextRender();
  }
  function nextRender() {
    const id = queue.shift();
    if (!id) return void (rendering = false);
    rendering = true;
    const a = db.prepare('SELECT * FROM assets WHERE asset_id = ?').get(id);
    const out = join(a.package_path, 'preview.jpg');
    const exe = loadSettings().maxBatchExe;
    if (!existsSync(exe)) return nextRender();
    const p = spawn(exe, [RENDER_SCRIPT, '-sceneFile', a.max_path, '-mxsString', `out:${out}`], { windowsHide: true, stdio: 'ignore' });
    p.on('exit', () => {
      if (existsSync(out)) db.prepare('UPDATE assets SET preview_path = ?, updated_at = ? WHERE asset_id = ?').run(out, now(), id);
      nextRender();
    });
    p.on('error', () => nextRender());
  }

  return r;
}
