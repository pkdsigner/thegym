// Loads the inventory (scanner/output/stands.json + inventory.json) into the database.
// Safe to run again: scan facts are refreshed, the user's own values are never overwritten (blanks are filled).
// Usage (from app/): npm run import
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, transaction, refreshSearch, scanOutput } from './db.js';

const t0 = Date.now();
const now = new Date().toISOString();
const db = openDb();
const { stands } = JSON.parse(readFileSync(join(scanOutput, 'stands.json'), 'utf8'));
console.log(`Reading the inventory (this file is large)…`);
const { files } = JSON.parse(readFileSync(join(scanOutput, 'inventory.json'), 'utf8'));

const before = new Set(db.prepare('SELECT id FROM stands').all().map((r) => r.id));

// A first guess at the project type from the project's names; the user confirms it in the review.
const TYPE_WORDS = [
  ['BrandActivation', /activation|activ[ae]tion|roadshow|pop[\s-]?up|car display/i],
  ['Pavilion', /pavil|pavalian/i],
  ['Stage', /\bstage\b|main stage|dark stage/i],
  ['Event', /\bevents?\b|national day|ceremony|gathering|festival|iftar|conference|summit|graduation|award|launch|gala|townhall|groundbreaking/i],
  ['Kiosk', /kiosk|retail|\bshop\b|mall|counter|display stand|gondola/i],
  ['Interior', /interior|showroom|office|villa|residence|museum|lobby|apartment|living|dining|bedroom|restaurant|cafe|gym|lounge design/i],
];
// Venue only when a name says it outright; shows move between venues over the years, so no guessing from the show.
const VENUE_WORDS = [
  ['DWTC', /\bdwtc\b|world trade cent(re|er)|za'?abeel hall|maktoum hall|rashid hall|sheikh saeed hall/i],
  ['Dubai Exhibition Centre', /dubai exhibition cent(re|er)/i],
  ['Expo City Dubai', /expo city|expo ?2020/i],
  ['ADNEC', /\badnec\b/i],
  ['Expo Centre Sharjah', /expo cent(re|er) sharjah|sharjah expo/i],
  ['Dubai Mall', /dubai ?mall/i],
  ['Mall of the Emirates', /mall of (the )?emirates/i],
  ['Yas Mall', /yas mall/i],
  ['Madinat Jumeirah', /madinat/i],
  ['Emirates Towers', /emirates towers/i],
  ['Riyadh Front', /riyadh front/i],
];
function guessVenue(s) {
  const text = [s.title, s.projectFolder, ...s.versions.map((v) => v.name)].join(' ');
  return VENUE_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}

function guessType(s) {
  const text = [s.title, s.projectFolder, ...s.versions.map((v) => v.name)].join(' ');
  if (/\bstand\b|booth|@|gitex|gulfood|exhib/i.test(s.title) && !/activation/i.test(text)) return 'ExhibitionStand';
  return TYPE_WORDS.find(([, re]) => re.test(text))?.[0] ?? 'ExhibitionStand';
}

const upsertStand = db.prepare(`
  INSERT INTO stands (id, status, project_type, venue, title, client, show, year, width, depth, area, size_source, created_at, updated_at,
    scan_title, scan_client, scan_show, scan_year, scan_width, scan_depth, scan_area, scan_size_text, scan_suggested_id,
    scan_renderer, scan_project, scan_last_modified, scan_versions, scan_preview, scan_thumbnail,
    scan_textures_missing, scan_textures_total, scan_objects, scan_seen_at)
  VALUES (:id, 'unreviewed', :project_type, :venue, :title, :client, :show, :year, :width, :depth, :area, :size_source, :now, :now,
    :title, :client, :show, :year, :width, :depth, :area, :size_text, :suggested_id,
    :renderer, :project, :last_modified, :versions, :preview, :thumbnail,
    :textures_missing, :textures_total, :objects, :now)
  ON CONFLICT(id) DO UPDATE SET
    project_type = COALESCE(stands.project_type, excluded.project_type),
    venue = COALESCE(stands.venue, excluded.venue),
    title = COALESCE(stands.title, excluded.title),
    client = COALESCE(stands.client, excluded.client),
    show = COALESCE(stands.show, excluded.show),
    year = COALESCE(stands.year, excluded.year),
    width = COALESCE(stands.width, excluded.width),
    depth = COALESCE(stands.depth, excluded.depth),
    area = COALESCE(stands.area, excluded.area),
    size_source = COALESCE(stands.size_source, excluded.size_source),
    scan_title = excluded.scan_title, scan_client = excluded.scan_client, scan_show = excluded.scan_show,
    scan_year = excluded.scan_year, scan_width = excluded.scan_width, scan_depth = excluded.scan_depth,
    scan_area = excluded.scan_area, scan_size_text = excluded.scan_size_text, scan_suggested_id = excluded.scan_suggested_id,
    scan_renderer = excluded.scan_renderer, scan_project = excluded.scan_project,
    scan_last_modified = excluded.scan_last_modified, scan_versions = excluded.scan_versions,
    scan_preview = excluded.scan_preview, scan_thumbnail = excluded.scan_thumbnail,
    scan_textures_missing = excluded.scan_textures_missing, scan_textures_total = excluded.scan_textures_total,
    scan_objects = excluded.scan_objects, scan_seen_at = excluded.scan_seen_at
`);

const upsertFile = db.prepare(`
  INSERT INTO source_files (file_id, stand_id, path, name, folder, archive, size_bytes, modified, saved_as_year, renderer,
    renderer_name, objects, faces, materials, default_name_pct, textures_total, textures_missing, preview_source, thumbnail,
    likely, class_reason, duplicate_of, scan_seen_at)
  VALUES (:file_id, :stand_id, :path, :name, :folder, :archive, :size_bytes, :modified, :saved_as_year, :renderer,
    :renderer_name, :objects, :faces, :materials, :default_name_pct, :textures_total, :textures_missing, :preview_source,
    :thumbnail, :likely, :class_reason, :duplicate_of, :now)
  ON CONFLICT(file_id) DO UPDATE SET
    stand_id = excluded.stand_id, path = excluded.path, name = excluded.name, folder = excluded.folder,
    archive = excluded.archive, size_bytes = excluded.size_bytes, modified = excluded.modified,
    saved_as_year = excluded.saved_as_year, renderer = excluded.renderer, renderer_name = excluded.renderer_name,
    objects = excluded.objects, faces = excluded.faces, materials = excluded.materials,
    default_name_pct = excluded.default_name_pct, textures_total = excluded.textures_total,
    textures_missing = excluded.textures_missing, preview_source = excluded.preview_source,
    thumbnail = excluded.thumbnail, likely = excluded.likely, class_reason = excluded.class_reason,
    duplicate_of = excluded.duplicate_of, scan_seen_at = excluded.scan_seen_at
`);
const clearTextures = db.prepare('DELETE FROM textures WHERE file_id = ?');
const addTexture = db.prepare('INSERT INTO textures (file_id, path, status, reason, found_at) VALUES (?, ?, ?, ?, ?)');
const clearRenders = db.prepare('DELETE FROM renders WHERE stand_id = ?');
const addRender = db.prepare('INSERT OR IGNORE INTO renders (stand_id, path, position) VALUES (?, ?, ?)');

transaction(db, () => {
  for (const s of stands) {
    upsertStand.run({
      id: s.id,
      project_type: guessType(s),
      venue: guessVenue(s),
      title: s.title,
      client: s.client,
      show: s.show,
      year: s.year,
      width: s.size?.width ?? null,
      depth: s.size?.depth ?? null,
      area: s.size?.area ?? null,
      size_source: s.size ? 'name' : null,
      size_text: s.size?.text ?? null,
      suggested_id: s.suggestedId,
      renderer: s.renderer,
      project: s.projectFolder,
      last_modified: s.lastModified,
      versions: s.versionCount,
      preview: s.previewSource,
      thumbnail: s.thumbnail,
      textures_missing: s.texturesMissing,
      textures_total: s.texturesTotal,
      objects: s.objects,
      now,
    });
    clearRenders.run(s.id);
    s.renders.forEach((p, i) => addRender.run(s.id, p, i));
  }

  files.forEach((r, n) => {
    upsertFile.run({
      file_id: r.id,
      stand_id: r.standId ?? null,
      path: r.path,
      name: r.name,
      folder: r.folder,
      archive: r.archive ?? null,
      size_bytes: r.size,
      modified: r.modified,
      saved_as_year: r.savedAsYear ?? null,
      renderer: r.renderer ?? null,
      renderer_name: r.rendererName ?? null,
      objects: r.counts?.total ?? null,
      faces: r.counts?.faces ?? null,
      materials: r.materials?.length ?? null,
      default_name_pct: r.defaultNamePct ?? null,
      textures_total: r.texturesTotal ?? null,
      textures_missing: r.texturesMissing ?? null,
      preview_source: r.previewSource,
      thumbnail: r.thumbnail ? join(scanOutput, r.thumbnail) : null,
      likely: r.likely,
      class_reason: r.classReason,
      duplicate_of: r.duplicateOf ?? null,
      now,
    });
    clearTextures.run(r.id);
    for (const t of r.textures || []) addTexture.run(r.id, t.path, t.status, t.reason ?? null, t.foundAt ?? null);
    if ((n + 1) % 200 === 0) process.stdout.write(`  files ${n + 1}/${files.length}\r`);
  });

  for (const s of stands) refreshSearch(db, s.id);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_import', ?)").run(now);
});

const added = stands.filter((s) => !before.has(s.id)).length;
const gone = db.prepare('SELECT COUNT(*) n FROM stands WHERE scan_seen_at < ?').get(now).n;
const byStatus = db.prepare('SELECT status, COUNT(*) n FROM stands GROUP BY status').all();
console.log(' '.repeat(40));
console.log(`Imported ${stands.length} stands (${added} new) and ${files.length} scene files in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
console.log(`By status: ${byStatus.map((s) => `${s.status} ${s.n}`).join(', ')}`);
if (gone) console.log(`${gone} stands from an earlier import were not found this time (kept, with their review data).`);
db.close();
