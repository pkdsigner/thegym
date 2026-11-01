// Checks the essentials end to end: import, review edits, naming on approval, search and filters, safety.
// Runs the real import and server against a throwaway library and scan folder - never the real ones.
// Usage (from app/): npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'standvault-test-'));
const library = join(root, 'library');
const scan = join(root, 'scan');
const projects = join(root, 'projects');
const PORT = 5199;
const env = { ...process.env, STANDVAULT_LIBRARY: library, STANDVAULT_SCAN_OUTPUT: scan, STANDVAULT_NO_PREVIEW: '1', PORT: String(PORT) };
const base = `http://127.0.0.1:${PORT}/api`;
let server;

// ---- A tiny made-up scan: one exhibition stand (2 versions), one event, one loose model ----

function file(id, path, standId, extra = {}) {
  return {
    id,
    standId,
    path,
    name: path.split('\\').pop(),
    folder: dirname(path),
    size: 1000,
    modified: '2025-10-01T10:00:00.000Z',
    savedAsYear: 2024,
    renderer: 'VRay',
    counts: { total: 500, faces: 10000 },
    materials: [],
    defaultNamePct: 10,
    texturesTotal: 2,
    texturesMissing: 1,
    previewSource: 'none',
    thumbnail: null,
    likely: standId ? 'full stand' : 'single asset',
    classReason: 'test',
    textures: [
      { path: 'Z:\\maps\\wood.jpg', status: 'missing', reason: 'drive Z: not connected' },
      { path: join(projects, 'maps', 'oak.jpg'), status: 'ok' },
    ],
    ...extra,
  };
}

function writeScan() {
  const dewa = join(projects, 'DEWA GITEX 2025', 'MAX');
  const bloom = join(projects, 'Bloom National Day', 'MAX');
  for (const d of [dewa, bloom, join(projects, 'maps'), join(projects, 'Mall Kiosk', 'MAX')]) mkdirSync(d, { recursive: true });
  const files = [
    file('f1', join(dewa, 'DEWA @ GITEX 2025 10x10 A1.max'), 'st-dewa'),
    file('f2', join(dewa, 'DEWA @ GITEX 2025 10x10 A2.max'), 'st-dewa', { modified: '2025-10-05T10:00:00.000Z' }),
    file('f3', join(bloom, 'Bloom_Site_V01.max'), 'st-bloom'),
    file('f4', join(projects, 'Chair.max'), null),
    file('f5', join(projects, 'Mall Kiosk', 'MAX', 'Kiosk V1.max'), 'st-mall'),
  ];
  const stand = (id, title, extra) => ({
    id,
    title,
    client: null,
    show: null,
    year: null,
    size: null,
    suggestedId: null,
    renderer: 'VRay',
    projectFolder: projects,
    lastModified: '2025-10-05T10:00:00.000Z',
    versionCount: 1,
    previewSource: 'none',
    renders: [],
    thumbnail: null,
    texturesMissing: 1,
    texturesTotal: 2,
    objects: 500,
    versions: [],
    ...extra,
  });
  const stands = [
    stand('st-dewa', 'DEWA @ GITEX 2025', {
      client: 'DEWA',
      show: 'GITEX',
      year: 2025,
      size: { width: 10, depth: 10, area: 100, text: '10x10' },
      versionCount: 2,
      versions: [{ name: files[1].name }, { name: files[0].name }],
    }),
    stand('st-bloom', 'Bloom UAE National Day', { client: 'Bloom', versions: [{ name: files[2].name }] }),
    stand('st-mall', 'Mall Kiosk', { versions: [{ name: files[4].name }], lastModified: '2025-09-01T10:00:00.000Z' }),
  ];
  mkdirSync(scan, { recursive: true });
  writeFileSync(join(scan, 'stands.json'), JSON.stringify({ stands }));
  writeFileSync(join(scan, 'inventory.json'), JSON.stringify({ files }));
}

const runImport = () => {
  const r = spawnSync(process.execPath, [join(here, 'import.js')], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, data };
};
const patch = (id, body) => call('PATCH', `/stands/${id}`, body);

before(async () => {
  writeScan();
  runImport();
  server = spawn(process.execPath, [join(here, 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('server did not start')), 15000);
    server.stdout.on('data', (d) => String(d).includes('StandVault server on') && (clearTimeout(t), ok()));
    server.on('exit', (code) => fail(new Error(`server exited ${code}`)));
  });
});

after(async () => {
  // The server holds the test database open until it has exited.
  if (server && server.exitCode === null) await new Promise((ok) => (server.once('exit', ok), server.kill()));
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('import loads stands and scene files, guesses the project type', async () => {
  const { data } = await call('GET', '/stats');
  assert.equal(data.stands, 3);
  assert.equal(data.files, 5);
  assert.equal(data.unsortedFiles, 1);
  const bloom = (await call('GET', '/stands/st-bloom')).data;
  assert.equal(bloom.project_type, 'Event');
  const dewa = (await call('GET', '/stands/st-dewa')).data;
  assert.equal(dewa.project_type, 'ExhibitionStand');
  assert.equal(dewa.versions.length, 2);
  assert.equal(dewa.versions[0].file_id, 'f2', 'newest version first');
  assert.equal(dewa.textures[0].status, 'missing', 'missing textures listed first');
});

test('re-import adds no duplicates and keeps the userÃ¢â‚¬â„¢s edits', async () => {
  await patch('st-dewa', { client: 'Dubai Electricity', favourite: true, notes: 'keep me', tags: ['curved'] });
  runImport();
  const { data } = await call('GET', '/stands/st-dewa');
  assert.equal(data.client, 'Dubai Electricity');
  assert.equal(data.favourite, 1);
  assert.equal(data.notes, 'keep me');
  assert.deepEqual(data.tags, ['curved']);
  assert.equal((await call('GET', '/stats')).data.stands, 3);
  await patch('st-dewa', { client: 'DEWA' });
});

test('saving with empty notes works', async () => {
  const r = await patch('st-bloom', { notes: '' });
  assert.equal(r.status, 200);
  assert.equal(r.data.notes, '');
});

test('approving needs the details, then names the stand with the next number', async () => {
  const noSize = await patch('st-bloom', { project_type: 'ExhibitionStand', status: 'approved' });
  assert.equal(noSize.status, 422);
  assert.match(noSize.data.error, /size/);

  const ok = await patch('st-dewa', { status: 'approved' });
  assert.equal(ok.status, 200, ok.data?.error);
  assert.equal(ok.data.asset_id, 'ST_10x10_GITEX2025_DEWA_0001');
  assert.equal(ok.data.number, 1);

  // Correcting an approved stand renames it and keeps its number.
  const fixed = await patch('st-dewa', { width: 12.5 });
  assert.equal(fixed.data.asset_id, 'ST_12p5x10_GITEX2025_DEWA_0001');
});

test('events are named by setting and occasion, not a size', async () => {
  const noSetting = await call('POST', '/stands/st-bloom/check-name', { project_type: 'Event', show: 'UAE National Day', year: 2025, client: 'Bloom' });
  assert.equal(noSetting.data.valid, false);
  const r = await patch('st-bloom', { project_type: 'Event', setting: 'Outdoor', show: 'UAE National Day', year: 2025, client: 'Bloom', status: 'approved' });
  assert.equal(r.status, 200, r.data?.error);
  assert.equal(r.data.asset_id, 'ST_Outdoor_UAENationalDay2025_Bloom_0002');
});

test('search finds tags, labels and venues; filters narrow the list', async () => {
  await patch('st-bloom', { venue: 'Dubai Mall', labels: { eventElement: ['PhotoWall'], eventCategory: ['Celebration'] } });
  const byWords = await call('GET', '/stands?q=photo%20wall');
  assert.deepEqual(byWords.data.items.map((s) => s.id), ['st-bloom']);
  assert.equal((await call('GET', '/stands?q=curved')).data.total, 1, 'free tag');
  assert.equal((await call('GET', '/stands?venue=Dubai%20Mall')).data.total, 1);
  assert.equal((await call('GET', '/stands?eventCategory=Celebration')).data.total, 1);
  assert.equal((await call('GET', '/stands?projectType=Event')).data.total, 1);
  assert.equal((await call('GET', '/stands')).data.total, 3, 'empty search returns everything');
});

test('size search works either way round, within the tolerance', async () => {
  const ids = async (q) => (await call('GET', `/stands?${q}`)).data.items.map((s) => s.id);
  assert.deepEqual(await ids('w=10&d=12&tol=0.5'), ['st-dewa'], '12.5 x 10 found as 10 x 12 Ã‚Â± 0.5');
  assert.deepEqual(await ids('w=10&d=10&tol=0'), []);
  assert.deepEqual(await ids('minArea=100&maxArea=300'), ['st-dewa']);
});

test('Ã¢â‚¬Å“not a standÃ¢â‚¬Â hides it from the library', async () => {
  await patch('st-bloom', { status: 'not_stand' });
  assert.equal((await call('GET', '/stands')).data.total, 2);
  await patch('st-bloom', { status: 'unreviewed' });
});

test('quick sort: confirm categories in a batch, mark "not a project", undo', async () => {
  let sort = (await call('GET', '/sort')).data;
  const unsortedBefore = sort.left;
  assert.ok(unsortedBefore >= 1);
  const ids = sort.items.map((s) => s.id);
  const r = await call('POST', '/sort', { changes: [{ id: ids[0], project_type: 'Pavilion' }] });
  assert.equal(r.data.done, 1);
  assert.equal((await call('GET', `/stands/${ids[0]}`)).data.project_type, 'Pavilion');
  sort = (await call('GET', '/sort')).data;
  assert.equal(sort.left, unsortedBefore - 1);
  assert.equal((await call('POST', '/sort', { changes: [{ id: ids[0], project_type: 'Spaceship' }] })).status, 400);

  await call('POST', '/sort/undo', { previous: r.data.previous });
  sort = (await call('GET', '/sort')).data;
  assert.equal(sort.left, unsortedBefore, 'undo puts it back');
  assert.notEqual((await call('GET', `/stands/${ids[0]}`)).data.project_type, 'Pavilion');

  const gone = await call('POST', '/sort', { changes: [{ id: ids[0], notProject: true }] });
  assert.equal((await call('GET', `/stands/${ids[0]}`)).data.status, 'not_stand');
  await call('POST', '/sort/undo', { previous: gone.data.previous });
  assert.equal((await call('GET', `/stands/${ids[0]}`)).data.status, gone.data.previous[0].status);
});

test('the review queue can be limited to one category', async () => {
  const all = (await call('GET', '/review?count=10')).data;
  const events = (await call('GET', '/review?count=10&type=Event')).data;
  assert.ok(events.left <= all.left);
  for (const id of events.queue) assert.equal((await call('GET', `/stands/${id}`)).data.project_type, 'Event');
});

test('shortlists: create, add, list, remove', async () => {
  const { data: list } = await call('POST', '/shortlists', { name: 'Brand X - GITEX 2026' });
  await call('POST', `/shortlists/${list.id}/items`, { standId: 'st-dewa' });
  let lists = (await call('GET', '/shortlists')).data;
  assert.deepEqual(lists.find((l) => l.id === list.id).items.map((i) => i.id), ['st-dewa']);
  await call('DELETE', `/shortlists/${list.id}/items/st-dewa`);
  lists = (await call('GET', '/shortlists')).data;
  assert.equal(lists.find((l) => l.id === list.id).items.length, 0);
});

test('Save to Library: name check, reserve, done, numbering per level, failed saves give the number back', async () => {
  const majlis = { level: 'ZN', type: 'Majlis', theme: 'ArabicTraditional', descriptor: 'low seating curved', tags: ['Sadu'] };
  const name = await call('POST', '/library/name', majlis);
  assert.equal(name.data.id, 'ZN_Majlis_ArabicTraditional_LowSeatingCurved_0001');
  assert.equal(name.data.valid, true);
  assert.equal((await call('POST', '/library/name', { ...majlis, type: 'Spaceship' })).data.valid, false);

  const r = await call('POST', '/library/reserve', { ...majlis, sourceScene: join(projects, 'DEWA GITEX 2025', 'MAX', 'DEWA @ GITEX 2025 10x10 A2.max') });
  assert.equal(r.status, 200, r.data?.error);
  assert.equal(r.data.shortId, 'ZN0001');
  assert.ok(r.data.packageDir.startsWith(join(library, 'Zones', 'Majlis')));
  // 3ds Max saves the package; here a stand-in file
  writeFileSync(r.data.maxPath, 'max');
  const done = await call('POST', `/library/assets/${r.data.assetId}/done`, { objects: 12, texturesTotal: 5, texturesMissing: 1 });
  assert.equal(done.data.status, 'ready');
  assert.equal(done.data.sourceStand.id, 'st-dewa', 'linked to the stand it was harvested from');
  assert.deepEqual(done.data.tags, ['sadu']);

  // a failed save frees its number
  const second = await call('POST', '/library/reserve', { ...majlis, descriptor: 'falcon perch' });
  assert.equal(second.data.assetId, 'ZN_Majlis_ArabicTraditional_FalconPerch_0002');
  await call('POST', `/library/assets/${second.data.assetId}/failed`);
  assert.equal((await call('POST', '/library/name', majlis)).data.id.endsWith('_0002'), true);

  // objects count separately from zones
  assert.equal((await call('POST', '/library/name', { level: 'OB', type: 'Planter', theme: 'Contemporary', descriptor: 'round concrete' })).data.id, 'OB_Planter_Contemporary_RoundConcrete_0001');

  const list = (await call('GET', '/library/assets?level=ZN&q=sadu')).data;
  assert.deepEqual(list.items.map((a) => a.asset_id), ['ZN_Majlis_ArabicTraditional_LowSeatingCurved_0001']);
});

test('files outside the library and scan folders are refused', async () => {
  assert.equal((await call('POST', '/open-folder', { path: 'C:\\Windows\\System32\\drivers\\etc\\hosts' })).status, 403);
  assert.equal((await fetch(`${base}/image?path=${encodeURIComponent('C:\\Windows\\win.ini')}`)).status, 404);
});
