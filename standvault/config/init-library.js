// Creates the library folder tree from settings.json + taxonomy.json.
// Safe to run again: it only creates missing folders. Run it after adding new types.
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTaxonomy, typesFor } from './naming.js';

const here = dirname(fileURLToPath(import.meta.url));
const settings = JSON.parse(readFileSync(join(here, 'settings.json'), 'utf8'));
const tax = loadTaxonomy();

if (!settings.libraryRoot) {
  console.error('libraryRoot is not set in config/settings.json');
  process.exit(1);
}

const folders = [join(settings.libraryRoot, 'db')];
for (const level of tax.levels) {
  const base = join(settings.libraryRoot, level.folder);
  folders.push(base);
  for (const type of typesFor(level.code, tax) || []) folders.push(join(base, type));
}

let created = 0;
for (const f of folders) {
  if (!existsSync(f)) {
    mkdirSync(f, { recursive: true });
    created++;
  }
}
console.log(`Library: ${settings.libraryRoot} - ${created} folders created, ${folders.length - created} already existed.`);
