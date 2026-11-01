// The app uses the exact naming rules and taxonomy the scanner uses (config/ is the single source of truth).
export {
  validateAssetId,
  buildAssetId,
  suggestAssetId,
  shortId,
  toCamel,
  typesFor,
  levelDef,
  loadTaxonomy,
} from '../../../config/naming.js';

export const LEVELS = [
  { code: 'ST', label: 'Full Stands', one: 'stand', many: 'stands' },
  { code: 'ZN', label: 'Zones', one: 'zone', many: 'zones' },
  { code: 'OB', label: 'Objects', one: 'object', many: 'objects' },
];

// Taxonomy plus the types/themes added in Settings.
export function withExtras(tax, extras) {
  const add = (list, more = []) => [...list, ...more.filter((x) => !list.includes(x))];
  return {
    ...tax,
    zoneTypes: add(tax.zoneTypes, extras.zoneTypes),
    objectTypes: add(tax.objectTypes, extras.objectTypes),
    themes: add(tax.themes, extras.themes),
  };
}

// "ArabicTraditional" -> "Arabic Traditional", "AVWall" -> "AV Wall"
export const spaced = (code) => (code ? code.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') : '');
