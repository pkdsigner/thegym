import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAssetId,
  suggestAssetId,
  buildAssetId,
  shortId,
  packageRelPath,
  validateObjectName,
  objectName,
  isDefaultMaxName,
  toCamel,
  matchCode,
  loadTaxonomy,
  formatSize,
  parseSizeId,
  findSizeInText,
  parseAssetId,
} from './naming.js';

const tax = loadTaxonomy();

// The 10 example IDs from docs/NAMING.md must all pass.
const EXAMPLES = [
  'ST_10x10_GITEX2025_DEWA_0007',
  'ST_12x8_ADIPEC2024_ADNOC_0003',
  'ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012',
  'ZN_Reception_Contemporary_MarbleCurvedCounter_0031',
  'ZN_Pod_Futuristic_GlowingMeetingCapsule_0044',
  'ZN_ProductDisplay_Minimal_FloatingPlinthTrio_0058',
  'OB_Planter_Contemporary_RoundConcrete_0210',
  'OB_Vegetation_Natural_OliveTreeLarge_0118',
  'OB_People_Mixed_StandingGroupOf3_0450',
  'OB_Lighting_Luxury_BrassPendantCluster_0302',
];

test('all documented examples are valid with no warnings', () => {
  for (const id of EXAMPLES) {
    const r = validateAssetId(id, tax);
    assert.equal(r.valid, true, `${id}: ${r.errors.join(' ')}`);
    assert.deepEqual(r.warnings, [], `${id}: ${r.warnings.join(' ')}`);
  }
});

test('bad names are rejected with a helpful fix', () => {
  const cases = [
    ['ZN_Majlis_Arabic Traditional_Low seating curved_12', 'ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012'],
    ['zn_majlis_arabic_low seating curved_12', 'ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012'],
    ['ZN_ArabicTraditional_Majlis_LowSeatingCurved_0012', 'ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012'],
    ['OB_Planter_Contemporary_RoundConcrete', 'OB_Planter_Contemporary_RoundConcrete_####'],
    ['object planter contemporary round concrete 210', 'OB_Planter_Contemporary_RoundConcrete_0210'],
    ['ST_10X10_gitex 2025_dewa_7', 'ST_10x10_Gitex2025_Dewa_0007'],
    ['stand 10 x 10 GITEX 2025 DEWA', 'ST_10x10_GITEX2025_DEWA_####'],
    ['ST 4.5x3 ATM 2019 Ajman Tourism 2', 'ST_4p5x3_ATM2019_AjmanTourism_0002'],
  ];
  for (const [bad, fixed] of cases) {
    const r = validateAssetId(bad, tax);
    assert.equal(r.valid, false, bad);
    assert.ok(r.errors.length > 0, bad);
    assert.equal(r.suggestion, fixed, bad);
  }
});

test('specific errors are explained', () => {
  assert.match(validateAssetId('XX_Majlis_Minimal_Test_0001', tax).errors.join(), /level code/);
  assert.match(validateAssetId('ZN_Spaceship_Minimal_Test_0001', tax).errors.join(), /not a known Zone/);
  assert.match(validateAssetId('ZN_Minimal_Majlis_Test_0001', tax).errors.join(), /is a theme, not a type/);
  assert.match(validateAssetId('ZN_Majlis_Spooky_Test_0001', tax).errors.join(), /not a known theme/);
  assert.match(validateAssetId('ZN_Majlis_Minimal_lowSeat_0001', tax).errors.join(), /CamelCase/);
  assert.match(validateAssetId('ZN_Majlis_Minimal_Test_12', tax).errors.join(), /4 digits/);
  assert.match(validateAssetId('ZN_Majlis_Minimal_Test_0000', tax).errors.join(), /0000/);
  assert.match(validateAssetId('OB_Chair_Minimal_0001', tax).errors.join(), /5 parts/);
  assert.match(validateAssetId('ZN_Majlis_Minimal_Low-Seat_0001', tax).errors.join(), /Only letters/);
  assert.equal(validateAssetId('', tax).valid, false);
});

test('a stand without a year gets a warning, not an error', () => {
  const r = validateAssetId('ST_6x6_BrandX_Acme_0001', tax);
  assert.equal(r.valid, true);
  assert.match(r.warnings.join(), /year/);
});

test('stand names: size first, old theme format explained', () => {
  assert.match(validateAssetId('ST_Futuristic_GITEX2025_0007', tax).errors.join(), /old stand format/);
  assert.match(validateAssetId('ST_Futuristic_GITEX2025_DEWA_0007', tax).errors.join(), /named by size/);
  assert.match(validateAssetId('ST_10X10_GITEX2025_DEWA_0007', tax).errors.join(), /small x/);
  assert.equal(validateAssetId('ST_4p5x3_ATM2019_Ajman_0002', tax).valid, true);
  assert.equal(validateAssetId('ST_Outdoor_UAENationalDay2025_Bloom_0013', tax).valid, true);
  assert.equal(validateAssetId('ST_Outside_UAENationalDay2025_Bloom_0013', tax).valid, false);
  assert.deepEqual(parseSizeId('4p5x3'), { width: 4.5, depth: 3 });
  assert.equal(formatSize(4.5, 3), '4p5x3');
  assert.equal(formatSize(10, 10), '10x10');
  assert.deepEqual(
    { ...parseAssetId('ST_10x10_GITEX2025_DEWA_0007', tax) },
    { level: 'ST', type: null, size: '10x10', width: 10, depth: 10, show: 'GITEX2025', client: 'DEWA', number: '0007' },
  );
});

test('stand sizes are found in file and folder names', () => {
  assert.deepEqual(findSizeInText('direction 2  - 15x15.max', tax), { width: 15, depth: 15, area: 225, text: '15x15' });
  assert.equal(findSizeInText('stand 6 X 9 m option 2', tax).area, 54);
  assert.equal(findSizeInText('Booth 4.5*3', tax).width, 4.5);
  assert.equal(findSizeInText('NEW MURABBA_800SQMT_v04', tax).area, 800);
  assert.equal(findSizeInText('render 1920x1080.jpg', tax), null);
  assert.equal(findSizeInText('DEWA @ GITEX 2019 A7 9-06-2019', tax), null);
});

test('helpers', () => {
  assert.equal(toCamel('low seating  curved'), 'LowSeatingCurved');
  assert.equal(toCamel('GITEX 2025'), 'GITEX2025');
  assert.equal(matchCode('arabic', tax.themes), 'ArabicTraditional');
  assert.equal(matchCode('coffee table', tax.objectTypes), 'CoffeeTable');
  assert.equal(matchCode('con', tax.themes), null);
  assert.equal(
    buildAssetId({ level: 'ZN', type: 'Majlis', theme: 'ArabicTraditional', descriptor: 'low seating curved', number: 12 }, tax),
    'ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012'
  );
  assert.equal(shortId('ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012'), 'ZN0012');
  assert.equal(packageRelPath('ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012', tax), 'Zones/Majlis/ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012');
  assert.equal(packageRelPath('ST_10x10_GITEX2025_DEWA_0007', tax), 'Stands/ST_10x10_GITEX2025_DEWA_0007');
  assert.equal(
    buildAssetId({ level: 'ST', size: { width: 10, depth: 10 }, show: 'GITEX 2025', client: 'dewa', number: 7 }, tax),
    'ST_10x10_GITEX2025_Dewa_0007'
  );
  assert.equal(suggestAssetId('hello', tax), null);
});

test('object names inside an asset file', () => {
  const id = 'ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012';
  assert.equal(objectName(id, 'cushion back', 2), 'ZN0012_CushionBack_02');
  assert.equal(validateObjectName('ZN0012_Sofa_01', id).valid, true);
  assert.equal(validateObjectName('ZN0013_Sofa_01', id).valid, false);
  assert.equal(validateObjectName('Sofa01').valid, false);
  assert.equal(validateObjectName('ZN0012_sofa_01').valid, false);
});

test('default 3ds Max object names are detected', () => {
  for (const n of ['Box001', 'Line045', 'Object023', 'Cylinder12', 'ChamferBox003', 'Plane 01']) assert.equal(isDefaultMaxName(n), true, n);
  for (const n of ['ZN0012_Sofa_01', 'Sofa_Left', 'Boxwood_Hedge']) assert.equal(isDefaultMaxName(n), false, n);
});
