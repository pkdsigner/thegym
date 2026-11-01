// Usage: npm run check-name -- "ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012" ["another name" ...]
import { validateAssetId, packageRelPath, shortId } from './naming.js';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.log('Usage: npm run check-name -- "<Asset ID>" ["<Asset ID>" ...]');
  process.exit(1);
}

let failed = 0;
for (const name of names) {
  const r = validateAssetId(name);
  console.log(`\n${r.valid ? 'OK  ' : 'FAIL'}  ${name}`);
  if (r.valid) {
    console.log(`      short ID: ${shortId(name)}   folder: ${packageRelPath(name)}`);
  } else {
    failed++;
  }
  for (const e of r.errors) console.log(`      - ${e}`);
  for (const w of r.warnings) console.log(`      ! ${w}`);
  if (r.suggestion) console.log(`      suggestion: ${r.suggestion}`);
}
process.exit(failed ? 1 : 0);
