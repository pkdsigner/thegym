// StandVault naming rules. Shared by the scanner, the web app and (as a port) the 3ds Max tools.
// The rules are described in docs/NAMING.md; the allowed codes live in taxonomy.json.
// No Node-only imports here, so the browser can use this file as is.
import taxonomy from './taxonomy.json' with { type: 'json' };

export function loadTaxonomy() {
  return structuredClone(taxonomy);
}

// A CamelCase word: starts with a capital letter or digit, then letters/digits only.
const CAMEL_WORD = /^[A-Z0-9][A-Za-z0-9]*$/;
const YEAR_SUFFIX = /(19|20)\d{2}$/;
const NUMBER_PLACEHOLDER = '####';

// Default names 3ds Max gives new objects, e.g. Box001, Line045, Object023.
const DEFAULT_MAX_NAME =
  /^(Box|ChamferBox|Sphere|GeoSphere|Cylinder|ChamferCyl|Cone|Tube|Torus|Pyramid|Plane|Teapot|Line|Rectangle|Circle|Ellipse|Arc|NGon|Star|Text|Helix|Shape|Object|Group|Mesh|Editable_Poly|Loft|Extrude|Capsule|Spindle|Hedra|Prism|Gengon|OilTank)[ _]?\d{2,}$/i;

export function toCamel(text) {
  return String(text)
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

export function levelDef(code, tax) {
  return tax.levels.find((l) => l.code === code) || null;
}

export function typesFor(levelCode, tax) {
  if (levelCode === 'ZN') return tax.zoneTypes;
  if (levelCode === 'OB') return tax.objectTypes;
  return null;
}

// Finds the taxonomy entry a loosely typed word refers to: exact, case-insensitive,
// ignoring spaces/punctuation, or a unique prefix of 4+ letters ("arabic" -> ArabicTraditional).
export function matchCode(value, list) {
  if (!value || !list) return null;
  if (list.includes(value)) return value;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const v = norm(value);
  if (!v) return null;
  const exact = list.find((item) => norm(item) === v);
  if (exact) return exact;
  if (v.length < 4) return null;
  const prefixed = list.filter((item) => norm(item).startsWith(v));
  return prefixed.length === 1 ? prefixed[0] : null;
}

function formatFor(level) {
  return level === 'ST' ? 'ST_<Width>x<Depth>_<Show><Year>_<Client>_<####>' : `${level}_<Type>_<Theme>_<Descriptor>_<####>`;
}

// ---- Stand sizes: width x depth in metres. In an ID a half metre is written with "p": 4.5 x 3 -> 4p5x3 ----

const SIZE_IN_ID = /^(\d{1,3})(?:p(\d))?x(\d{1,3})(?:p(\d))?$/;

export function formatSize(width, depth) {
  const f = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', 'p');
  return `${f(width)}x${f(depth)}`;
}

// "10x10" or "4p5x3" -> { width: 10, depth: 10 }; null when it isn't a size.
export function parseSizeId(text) {
  const m = SIZE_IN_ID.exec(String(text));
  if (!m) return null;
  const n = (whole, tenth) => Number(whole) + (tenth ? Number(tenth) / 10 : 0);
  return { width: n(m[1], m[2]), depth: n(m[3], m[4]) };
}

// Finds a stand size written anywhere in free text: "15x15", "6 X 9", "4.5*3", "12 x 8 m". Sizes outside
// 2-100 m are ignored (so render resolutions like 1920x1080 never count). Also reports areas like "800 sqm".
export function findSizeInText(text, tax = loadTaxonomy()) {
  const s = String(text);
  const max = tax.rules.maxStandMetres;
  const ok = (n) => n >= 2 && n <= max;
  const dims = /(?<![\d.])(\d{1,3}(?:\.\d{1,2})?)\s*(?:m\s*)?[x×*]\s*(\d{1,3}(?:\.\d{1,2})?)(?!\d|\.\d)/gi;
  for (const m of s.matchAll(dims)) {
    const width = Number(m[1]);
    const depth = Number(m[2]);
    if (ok(width) && ok(depth)) return { width, depth, area: Math.round(width * depth * 10) / 10, text: m[0] };
  }
  const area = /(?<![\d.])(\d{1,4}(?:\.\d)?)\s*(?:sq\.?\s*m(?:t|tr|eters?)?|sqm|m2|m²)(?![a-z])/i.exec(s);
  if (area && Number(area[1]) >= 4 && Number(area[1]) <= max * max) return { width: null, depth: null, area: Number(area[1]), text: area[0] };
  return null;
}

export function buildAssetId({ level, type, theme, descriptor, number, size, show, client }, tax = loadTaxonomy()) {
  const digits = tax.rules.numberDigits;
  const num = number == null ? NUMBER_PLACEHOLDER : String(number).padStart(digits, '0');
  if (level === 'ST') {
    const sizePart = typeof size === 'string' ? size : formatSize(size.width, size.depth);
    return [level, sizePart, toCamel(show), toCamel(client), num].join('_');
  }
  return [level, type, theme, toCamel(descriptor), num].join('_');
}

export function validateAssetId(id, tax = loadTaxonomy()) {
  const errors = [];
  const warnings = [];
  const result = () => {
    const valid = errors.length === 0;
    let suggestion = null;
    if (!valid) {
      const s = suggestAssetId(id, tax);
      if (s && s !== id) suggestion = s;
    }
    return { valid, errors, warnings, suggestion };
  };

  if (typeof id !== 'string' || id.trim() === '') {
    errors.push('The name is empty.');
    return result();
  }
  if (/\s/.test(id)) errors.push('Spaces are not allowed. Use CamelCase words and underscores between parts.');
  if (/[^A-Za-z0-9_\s]/.test(id)) errors.push('Only letters, numbers and underscores are allowed.');
  if (/__/.test(id) || id.startsWith('_') || id.endsWith('_')) errors.push('Use exactly one underscore between parts.');

  const parts = id.split('_');
  const level = parts[0];
  const def = levelDef(level, tax);
  if (!def) {
    errors.push(`It must start with a level code: ${tax.levels.map((l) => `${l.code} (${l.name})`).join(', ')}.`);
    return result();
  }

  if (parts.length !== 5) {
    const article = /^[AEIOU]/.test(def.name) ? 'An' : 'A';
    errors.push(
      level === 'ST' && tax.themes.includes(parts[1])
        ? `This is the old stand format. Stands are named by size now: ${formatFor('ST')}. The theme is kept as a tag.`
        : `${article} ${def.name} name has 5 parts: ${formatFor(level)}. This one has ${parts.length}.`
    );
    return result();
  }

  if (level === 'ST') {
    checkStand(parts, tax, errors, warnings);
    checkNumber(parts[4], tax, errors);
    return result();
  }

  const [type, theme, descriptor, number] = parts.slice(1);

  if (def.hasType) {
    const types = typesFor(level, tax);
    if (!types.includes(type)) {
      const swapped = tax.themes.includes(type);
      errors.push(
        swapped
          ? `"${type}" is a theme, not a type. The type comes first, then the theme.`
          : `"${type}" is not a known ${def.name} type. Known types: ${types.join(', ')}.`
      );
    }
  }

  if (!tax.themes.includes(theme)) {
    errors.push(`"${theme}" is not a known theme. Known themes: ${tax.themes.join(', ')}.`);
  }

  if (!CAMEL_WORD.test(descriptor || '')) {
    errors.push(`The descriptor "${descriptor}" must be CamelCase letters and numbers, starting with a capital (e.g. LowSeatingCurved).`);
  } else if (descriptor.length > tax.rules.maxDescriptorLength) {
    warnings.push(`The descriptor is long (${descriptor.length} characters). Try to keep it under ${tax.rules.maxDescriptorLength}.`);
  }
  checkNumber(number, tax, errors);
  return result();
}

// ST_<Width>x<Depth>_<Show><Year>_<Client>_<####>
function checkStand([, size, show, client], tax, errors, warnings) {
  const dims = parseSizeId(size);
  const isSetting = (tax.settings || []).includes(size); // events without a footprint: Indoor / Outdoor / IndoorOutdoor
  if (!dims && !isSetting) {
    errors.push(
      tax.themes.includes(size)
        ? `Stands are named by size now, not theme: ${formatFor('ST')}. The theme ("${size}") is kept as a tag.`
        : `"${size}" is not a size. Write width x depth in metres with a small x, e.g. 10x10, or 4p5x3 for 4.5 x 3. Events can use ${(tax.settings || []).join(', ')}.`
    );
  } else if (dims && Math.max(dims.width, dims.depth) > tax.rules.maxStandMetres) {
    warnings.push(`${size} is a very large stand. Check the size is in metres.`);
  }
  if (!CAMEL_WORD.test(show || '')) {
    errors.push(`The show "${show}" must be one CamelCase word ending with the year, e.g. GITEX2025.`);
  } else if (!YEAR_SUFFIX.test(show)) {
    warnings.push(`The show should end with the year, e.g. ${show}2025.`);
  }
  if (!CAMEL_WORD.test(client || '')) {
    errors.push(`The client "${client}" must be CamelCase letters and numbers, starting with a capital (e.g. DEWA, UnitedImaging).`);
  } else if (client.length > tax.rules.maxDescriptorLength) {
    warnings.push(`The client name is long (${client.length} characters). Try to keep it under ${tax.rules.maxDescriptorLength}.`);
  }
}

function checkNumber(number, tax, errors) {
  const digitsRe = new RegExp(`^\\d{${tax.rules.numberDigits}}$`);
  if (!digitsRe.test(number)) {
    errors.push(`The number must be ${tax.rules.numberDigits} digits, e.g. 0012.`);
  } else if (/^0+$/.test(number)) {
    errors.push('The number cannot be 0000. Numbering starts at 0001.');
  }
}

// Best-effort repair of a badly formed name. Returns null when there is not enough to go on.
// When the number is missing the suggestion ends in #### (assigned automatically when saved).
export function suggestAssetId(raw, tax = loadTaxonomy()) {
  if (typeof raw !== 'string') return null;
  const tokens = raw.trim().split(/[_\s\-]+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const levelWords = { st: 'ST', stand: 'ST', zn: 'ZN', zone: 'ZN', space: 'ZN', ob: 'OB', obj: 'OB', object: 'OB' };
  const level = levelWords[tokens[0].toLowerCase()];
  if (!level) return null;
  if (level === 'ST') return suggestStandId(raw.trim().replace(/^\S+?[_\s-]+/, ''), tax);
  const def = levelDef(level, tax);

  let rest = tokens.slice(1);
  let number = null;
  const last = rest[rest.length - 1];
  const isStandYear = level === 'ST' && YEAR_SUFFIX.test(last) && last.length === 4;
  if (/^\d{1,4}$/.test(last) && !/^0+$/.test(last) && !isStandYear) {
    number = Number(last);
    rest = rest.slice(0, -1);
  }

  // Removes and returns the first token (or pair of tokens, e.g. "Arabic Traditional") matching the list.
  const take = (list) => {
    for (let i = 0; i < rest.length; i++) {
      for (const span of [2, 1]) {
        if (i + span > rest.length) continue;
        const code = matchCode(rest.slice(i, i + span).join(''), list);
        if (code) {
          rest = [...rest.slice(0, i), ...rest.slice(i + span)];
          return code;
        }
      }
    }
    return null;
  };

  const type = def.hasType ? take(typesFor(level, tax)) : null;
  if (def.hasType && !type) return null;
  const theme = take(tax.themes);
  if (!theme) return null;
  const descriptor = toCamel(rest.join(' '));
  if (!descriptor) return null;

  return buildAssetId({ level, type, theme, descriptor, number }, tax);
}

// "10x10 GITEX 2025 DEWA 7" -> ST_10x10_GITEX2025_DEWA_0007. Needs a size; the show is the word before the year.
function suggestStandId(rest, tax) {
  let text = rest.replace(/_/g, ' ');
  const sizeMatch = /(\d{1,3}(?:[.p]\d)?)\s*[x×*]\s*(\d{1,3}(?:[.p]\d)?)/i.exec(text);
  if (!sizeMatch) return null;
  const size = formatSize(Number(sizeMatch[1].replace('p', '.')), Number(sizeMatch[2].replace('p', '.')));
  text = text.replace(sizeMatch[0], ' ');

  let tokens = text.split(/[\s-]+/).filter(Boolean);
  let number = null;
  const last = tokens[tokens.length - 1];
  if (/^\d{1,4}$/.test(last) && !/^0+$/.test(last) && !(last.length === 4 && YEAR_SUFFIX.test(last))) {
    number = Number(last);
    tokens = tokens.slice(0, -1);
  }
  const yearAt = tokens.findIndex((t) => /^(19|20)\d{2}$/.test(t));
  let show;
  if (yearAt > 0) {
    show = tokens[yearAt - 1] + tokens[yearAt];
    tokens.splice(yearAt - 1, 2);
  } else {
    show = tokens.shift();
  }
  if (!show || !tokens.length) return null;
  return buildAssetId({ level: 'ST', size, show, client: tokens.join(' '), number }, tax);
}

export function parseAssetId(id, tax = loadTaxonomy()) {
  if (!validateAssetId(id, tax).valid) return null;
  const parts = id.split('_');
  if (parts[0] === 'ST') {
    return { level: 'ST', type: null, size: parts[1], ...parseSizeId(parts[1]), show: parts[2], client: parts[3], number: parts[4] };
  }
  return { level: parts[0], type: parts[1], theme: parts[2], descriptor: parts[3], number: parts[4] };
}

// ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012 -> ZN0012
export function shortId(id) {
  const parts = String(id).split('_');
  return parts[0] + parts[parts.length - 1];
}

// Package folder relative to the library root, e.g. Zones/Majlis/<AssetID>
export function packageRelPath(id, tax = loadTaxonomy()) {
  const p = parseAssetId(id, tax);
  if (!p) return null;
  const folder = levelDef(p.level, tax).folder;
  return p.type ? `${folder}/${p.type}/${id}` : `${folder}/${id}`;
}

// Object names inside an asset file: <ShortID>_<Part>_<##>, e.g. ZN0012_Sofa_01
export function validateObjectName(name, assetId = null) {
  const errors = [];
  const m = /^((?:ST|ZN|OB)\d{4})_([A-Za-z0-9]+)_(\d{2})$/.exec(String(name));
  if (!m) {
    errors.push('Object names follow <ShortID>_<Part>_<##>, e.g. ZN0012_Sofa_01.');
  } else {
    if (!CAMEL_WORD.test(m[2])) errors.push(`The part name "${m[2]}" must be CamelCase, starting with a capital.`);
    if (assetId && m[1] !== shortId(assetId)) errors.push(`This object belongs to ${shortId(assetId)}, so it must start with ${shortId(assetId)}_.`);
  }
  return { valid: errors.length === 0, errors };
}

export function objectName(assetId, part, index) {
  return `${shortId(assetId)}_${toCamel(part)}_${String(index).padStart(2, '0')}`;
}

export function isDefaultMaxName(name) {
  return DEFAULT_MAX_NAME.test(String(name).trim());
}
