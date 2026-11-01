// Reads what 3ds Max stores in a .max file's summary streams (File > File Properties) without opening Max.
import { deflateSync, crc32 } from 'node:zlib';
import { OleFile, parsePropertySet } from './ole.js';

const SUMMARY = '\x05SummaryInformation';
const DOC_SUMMARY = '\x05DocumentSummaryInformation';
const ASSETS = 'FileAssetMetaData3';

// Max release number -> year: 9 is 2007, 28 is 2026. Releases before 9 had no year in the name.
const yearOf = (v) => (v >= 9 ? 1998 + v : null);
const versionNumber = (s) => (s ? parseInt(s, 10) : null);

export function readMaxInfo(path) {
  const ole = new OleFile(path);
  try {
    const summary = parsePropertySet(ole.readStream(SUMMARY));
    const doc = parsePropertySet(ole.readStream(DOC_SUMMARY));
    const groups = groupTitles(doc.get(12), doc.get(13));

    const general = keyValues(groups['General'], ': ');
    const totals = { ...keyValues(groups['Mesh Totals'], ': '), ...keyValues(groups['Scene Totals'], ': ') };
    const render = keyValues(groups['Render Data'], '=');
    const plugins = groups['Used Plug-Ins'] || [];

    const maxVersion = versionNumber(general['3ds Max Version']);
    const savedAsVersion = versionNumber(general['Saved As Version']) ?? maxVersion;
    const rendererName = render['Renderer Name'] || null;

    return {
      title: summary.get(2) || null,
      author: summary.get(4) || null,
      comments: summary.get(6) || null,
      lastSavedBy: summary.get(8) || null,
      created: summary.get(12) || null,
      saved: summary.get(13) || null,
      maxVersion,
      maxYear: yearOf(maxVersion),
      savedAsVersion,
      savedAsYear: yearOf(savedAsVersion),
      build: general['Build'] || null,
      compressed: (groups['General'] || []).includes('Compressed'),
      rendererName,
      renderer: classifyRenderer(rendererName, plugins),
      renderWidth: toNumber(render['Render Width']),
      renderHeight: toNumber(render['Render Height']),
      renderCamera: render['Render Camera 00'] || null,
      counts: {
        vertices: toNumber(totals['Vertices']),
        faces: toNumber(totals['Faces']),
        objects: toNumber(totals['Objects']),
        shapes: toNumber(totals['Shapes']),
        lights: toNumber(totals['Lights']),
        cameras: toNumber(totals['Cameras']),
        helpers: toNumber(totals['Helpers']),
        total: toNumber(totals['Total']),
      },
      objects: groups['Objects'] || [],
      materials: groups['Materials'] || [],
      dependencies: groups['External Dependencies'] || [],
      assets: readAssets(ole.readStream(ASSETS)),
      plugins,
      hasSummary: doc.size > 0 || summary.size > 0,
      thumbnail: summary.get(17) || null, // raw clipboard data; see thumbnailPng()
    };
  } finally {
    ole.close();
  }
}

// Asset Tracking list: per record a 16-byte id, then type, stored path and resolved path,
// each a UInt32 character count + UTF-16 text + a 2-byte null the count leaves out.
// Returns [{ type, path }] with the resolved path when Max stored one. Null when the file has no list.
export function readAssets(buf) {
  if (!buf) return null;
  const out = [];
  let p = 0;
  const str = () => {
    const n = buf.readUInt32LE(p);
    const s = buf.toString('utf16le', p + 4, p + 4 + n * 2);
    p += 4 + n * 2 + 2;
    return s;
  };
  try {
    while (p + 20 <= buf.length) {
      p += 16;
      const type = str();
      const stored = str();
      const resolved = str();
      out.push({ type, path: resolved || stored });
    }
  } catch {
    // Truncated record: keep what was read.
  }
  return out;
}

// HeadingPairs (pid 12) is [name, count, name, count...]; TitlesOfParts (pid 13) is the flat list they slice.
function groupTitles(pairs, titles) {
  const out = {};
  if (!Array.isArray(pairs) || !Array.isArray(titles)) return out;
  let i = 0;
  for (let p = 0; p + 1 < pairs.length; p += 2) {
    const n = Number(pairs[p + 1]) || 0;
    out[pairs[p]] = titles.slice(i, i + n);
    i += n;
  }
  return out;
}

function keyValues(list = [], sep) {
  const out = {};
  for (const s of list) {
    const at = s.indexOf(sep);
    if (at > 0) out[s.slice(0, at).trim()] = s.slice(at + sep.length).trim();
  }
  return out;
}

function toNumber(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function classifyRenderer(name, plugins = []) {
  const test = (re) => (name ? re.test(name) : plugins.some((p) => re.test(p)));
  if (test(/v-?ray/i)) return 'VRay';
  if (test(/corona/i)) return 'Corona';
  return name ? 'Other' : null;
}

// ---- Thumbnail: clipboard data holding a DIB, usually wrapped in a Windows metafile ----

const CF_METAFILEPICT = 3;
const CF_DIB = 8;
const META_DIBSTRETCHBLT = 0x0b41;
const META_STRETCHDIB = 0x0f43;

export function thumbnailPng(cf) {
  if (!Buffer.isBuffer(cf) || cf.length < 16 || cf.readInt32LE(0) !== -1) return null;
  const format = cf.readUInt32LE(4);
  let dib = null;
  if (format === CF_DIB) dib = cf.subarray(8);
  else if (format === CF_METAFILEPICT) dib = dibFromWmf(cf.subarray(16)); // skip the 8-byte METAFILEPICT16 header
  return dib ? dibToPng(dib) : null;
}

function dibFromWmf(wmf) {
  if (wmf.length < 18) return null;
  let p = wmf.readUInt16LE(2) * 2;
  while (p + 6 <= wmf.length) {
    const size = wmf.readUInt32LE(p) * 2;
    const fn = wmf.readUInt16LE(p + 4);
    if (size < 6 || fn === 0) break;
    if (fn === META_DIBSTRETCHBLT || fn === META_STRETCHDIB) {
      const rec = wmf.subarray(p + 6, p + size);
      for (let o = 0; o <= 32 && o + 40 <= rec.length; o += 2) {
        if (rec.readUInt32LE(o) === 40) return rec.subarray(o);
      }
    }
    p += size;
  }
  return null;
}

function dibToPng(dib) {
  if (dib.length < 40 || dib.readUInt32LE(0) !== 40) return null;
  const w = dib.readInt32LE(4);
  const rawH = dib.readInt32LE(8);
  const h = Math.abs(rawH);
  const bpp = dib.readUInt16LE(14);
  const compression = dib.readUInt32LE(16);
  if (w <= 0 || h <= 0 || compression !== 0 || ![8, 24, 32].includes(bpp)) return null;
  const paletteSize = bpp === 8 ? (dib.readUInt32LE(32) || 256) : 0;
  const palette = dib.subarray(40, 40 + paletteSize * 4);
  const pixels = dib.subarray(40 + paletteSize * 4);
  const stride = ((w * bpp + 31) >> 5) * 4;
  if (pixels.length < stride * h) return null;

  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const src = (rawH > 0 ? h - 1 - y : y) * stride; // bottom-up unless height is negative
    let dst = y * (w * 3 + 1) + 1;
    for (let x = 0; x < w; x++, dst += 3) {
      let s = pixels;
      let i = src + x * (bpp / 8);
      if (bpp === 8) {
        s = palette;
        i = pixels[src + x] * 4;
      }
      raw[dst] = s[i + 2];
      raw[dst + 1] = s[i + 1];
      raw[dst + 2] = s[i];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0);
  return Buffer.concat([head, data, crc]);
}
