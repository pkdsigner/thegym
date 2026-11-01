// Dated copies of the database in <library>/db/backups. The server makes one a day; `npm run backup` makes one now.
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbFolder, openDb } from './db.js';

export const backupDir = () => join(dbFolder(), 'backups');

export function lastBackup() {
  if (!existsSync(backupDir())) return null;
  return readdirSync(backupDir()).filter((f) => f.endsWith('.db')).sort().pop() ?? null;
}

export function backupNow(db) {
  mkdirSync(backupDir(), { recursive: true });
  const file = join(backupDir(), `standvault-${new Date().toISOString().slice(0, 10)}.db`);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); // fold the write-ahead log into the main file first
  copyFileSync(join(dbFolder(), 'standvault.db'), file);
  return file;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  console.log(`Backed up to ${backupNow(db)}`);
  db.close();
}
