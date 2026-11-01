// Opens the StandVault database (Node's built-in SQLite, so nothing has to be compiled) and holds shared helpers.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(here, '..', '..');
// The tests point these at a throwaway folder, so they never touch the real library or scan results.
export const scanOutput = process.env.STANDVAULT_SCAN_OUTPUT || join(projectRoot, 'scanner', 'output');

export function loadSettings() {
  const settings = JSON.parse(readFileSync(join(projectRoot, 'config', 'settings.json'), 'utf8'));
  if (process.env.STANDVAULT_LIBRARY) settings.libraryRoot = process.env.STANDVAULT_LIBRARY;
  return settings;
}

// Read fresh each time, so shows/themes added in Settings count straight away.
export function readTaxonomy() {
  return JSON.parse(readFileSync(join(projectRoot, 'config', 'taxonomy.json'), 'utf8'));
}

export const dbFolder = () => join(loadSettings().libraryRoot, 'db');

export function openDb() {
  const folder = dbFolder();
  mkdirSync(folder, { recursive: true });
  const db = new DatabaseSync(join(folder, 'standvault.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  return db;
}

// Columns added after the first real import. CREATE TABLE IF NOT EXISTS doesn't add them to an existing table.
function migrate(db) {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stands'").get();
  if (!exists) return;
  const cols = db.prepare('PRAGMA table_info(stands)').all().map((c) => c.name);
  if (!cols.includes('project_type')) db.exec('ALTER TABLE stands ADD COLUMN project_type TEXT');
  if (!cols.includes('venue')) db.exec('ALTER TABLE stands ADD COLUMN venue TEXT');
  if (!cols.includes('setting')) db.exec('ALTER TABLE stands ADD COLUMN setting TEXT');
  if (!cols.includes('type_confirmed_at')) {
    db.exec('ALTER TABLE stands ADD COLUMN type_confirmed_at TEXT');
    db.exec("UPDATE stands SET type_confirmed_at = reviewed_at WHERE status = 'approved'"); // already checked in the review
  }
}

export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Search text for one stand: its names, tags and notes. Rebuilt whenever the stand changes.
export function refreshSearch(db, standId) {
  const s = db.prepare('SELECT * FROM stands WHERE id = ?').get(standId);
  db.prepare('DELETE FROM stands_fts WHERE stand_id = ?').run(standId);
  if (!s) return;
  const tags = db.prepare('SELECT tag FROM stand_tags WHERE stand_id = ?').all(standId).map((t) => t.tag);
  // "HangingFeature" is also searchable as "hanging feature"
  const words = (code) => (code ? `${code} ${code.replace(/([a-z])([A-Z])/g, '$1 $2')}` : null);
  const labels = db.prepare('SELECT value FROM stand_labels WHERE stand_id = ?').all(standId).map((l) => words(l.value));
  const text = [s.asset_id, s.title, s.client, s.show, s.year, words(s.project_type), s.venue, words(s.setting), s.open_sides, s.notes, s.scan_title, s.scan_project, ...tags, ...labels]
    .filter(Boolean)
    .join(' ');
  db.prepare('INSERT INTO stands_fts (stand_id, text) VALUES (?, ?)').run(standId, text);
}

// Files the app may read or open: the scan folders, the library and the scanner's output (thumbnails).
export function isAllowedPath(p) {
  const settings = loadSettings();
  const target = resolve(p).toLowerCase();
  const roots = [...settings.scanFolders, settings.libraryRoot, scanOutput].map((r) => resolve(r).toLowerCase().replace(/\\$/, ''));
  return roots.some((r) => target === r || target.startsWith(r + '\\'));
}
