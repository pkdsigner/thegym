// Minimal read-only reader for OLE compound files (the container format of .max files).
// Reads only the sectors needed for the requested streams, so multi-GB scenes are cheap to inspect.
import { openSync, readSync, closeSync, fstatSync } from 'node:fs';

const SIGNATURE = Buffer.from('d0cf11e0a1b11ae1', 'hex');
const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;

export class OleFile {
  constructor(path) {
    this.fd = openSync(path, 'r');
    this.fileSize = fstatSync(this.fd).size;
    try {
      this.#readHeader();
      this.#readFat();
      this.#readDirectory();
    } catch (e) {
      this.close();
      throw e;
    }
  }

  close() {
    if (this.fd != null) closeSync(this.fd);
    this.fd = null;
  }

  #read(offset, length) {
    const buf = Buffer.alloc(length);
    const n = readSync(this.fd, buf, 0, length, offset);
    return n === length ? buf : buf.subarray(0, n);
  }

  #sector(id) {
    return this.#read((id + 1) * this.sectorSize, this.sectorSize);
  }

  #readHeader() {
    const h = this.#read(0, 512);
    if (h.length < 512 || !h.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not an OLE compound file');
    this.sectorSize = 1 << h.readUInt16LE(0x1e);
    this.miniSectorSize = 1 << h.readUInt16LE(0x20);
    this.numFatSectors = h.readUInt32LE(0x2c);
    this.firstDirSector = h.readUInt32LE(0x30);
    this.miniCutoff = h.readUInt32LE(0x38);
    this.firstMiniFatSector = h.readUInt32LE(0x3c);
    this.firstDifatSector = h.readUInt32LE(0x44);
    this.header = h;
  }

  // Only the list of FAT sector locations is read up front. The FAT itself is read one sector at a time, when a
  // chain needs it: a multi-GB scene has megabytes of FAT spread over the file, which is slow on a hard disk.
  #readFat() {
    const fatSectors = [];
    for (let i = 0; i < 109 && fatSectors.length < this.numFatSectors; i++) {
      const id = this.header.readUInt32LE(0x4c + i * 4);
      if (id !== FREE) fatSectors.push(id);
    }
    let difat = this.firstDifatSector;
    const perDifat = this.sectorSize / 4 - 1;
    const seen = new Set();
    while (difat !== END_OF_CHAIN && difat !== FREE && fatSectors.length < this.numFatSectors) {
      if (seen.has(difat)) throw new Error('DIFAT loop');
      seen.add(difat);
      const s = this.#sector(difat);
      for (let i = 0; i < perDifat && fatSectors.length < this.numFatSectors; i++) {
        const id = s.readUInt32LE(i * 4);
        if (id !== FREE) fatSectors.push(id);
      }
      difat = s.readUInt32LE(perDifat * 4);
    }
    this.fatSectors = fatSectors;
    this.fatCache = new Map();
    this.perFatSector = this.sectorSize / 4;
    this.fatLength = fatSectors.length * this.perFatSector;
  }

  #fatEntry(id) {
    const index = Math.floor(id / this.perFatSector);
    let s = this.fatCache.get(index);
    if (!s) {
      s = this.#sector(this.fatSectors[index]);
      this.fatCache.set(index, s);
    }
    return s.readUInt32LE((id % this.perFatSector) * 4);
  }

  #chain(start, mini = null) {
    const length = mini ? mini.length : this.fatLength;
    const next = mini ? (id) => mini[id] : (id) => this.#fatEntry(id);
    const ids = [];
    let id = start;
    while (id !== END_OF_CHAIN && id !== FREE && id < length) {
      if (ids.length > length) throw new Error('Sector chain loop');
      ids.push(id);
      id = next(id);
    }
    return ids;
  }

  #readDirectory() {
    const dir = Buffer.concat(this.#chain(this.firstDirSector).map((id) => this.#sector(id)));
    this.entries = [];
    for (let off = 0; off + 128 <= dir.length; off += 128) {
      const nameLen = dir.readUInt16LE(off + 64);
      const type = dir[off + 66];
      if (type === 0 || nameLen < 2) continue;
      this.entries.push({
        name: dir.toString('utf16le', off, off + nameLen - 2),
        type, // 1 storage, 2 stream, 5 root
        start: dir.readUInt32LE(off + 116),
        size: dir.readUInt32LE(off + 120),
      });
    }
    this.root = this.entries.find((e) => e.type === 5);
  }

  streamNames() {
    return this.entries.filter((e) => e.type === 2).map((e) => e.name);
  }

  readStream(name, maxBytes = Infinity) {
    const e = this.entries.find((x) => x.type === 2 && x.name === name);
    if (!e) return null;
    const want = Math.min(e.size, maxBytes);
    if (e.size < this.miniCutoff) return this.#readMini(e.start, want);
    const parts = [];
    let got = 0;
    for (const id of this.#chain(e.start)) {
      if (got >= want) break;
      const s = this.#sector(id);
      parts.push(s);
      got += s.length;
    }
    return Buffer.concat(parts).subarray(0, want);
  }

  #readMini(start, length) {
    if (!this.miniFat) {
      const ids = this.#chain(this.firstMiniFatSector);
      const perSector = this.sectorSize / 4;
      this.miniFat = new Uint32Array(ids.length * perSector);
      ids.forEach((id, i) => {
        const s = this.#sector(id);
        for (let j = 0; j < perSector; j++) this.miniFat[i * perSector + j] = s.readUInt32LE(j * 4);
      });
      this.miniContainer = this.#chain(this.root.start);
    }
    const per = this.sectorSize / this.miniSectorSize;
    const out = [];
    let got = 0;
    for (const m of this.#chain(start, this.miniFat)) {
      if (got >= length) break;
      const big = this.miniContainer[Math.floor(m / per)];
      const off = (big + 1) * this.sectorSize + (m % per) * this.miniSectorSize;
      out.push(this.#read(off, this.miniSectorSize));
      got += this.miniSectorSize;
    }
    return Buffer.concat(out).subarray(0, length);
  }
}

// ---- Property sets (SummaryInformation / DocumentSummaryInformation) ----

const VT = { I2: 2, I4: 3, BOOL: 11, VARIANT: 12, UI4: 19, LPSTR: 30, LPWSTR: 31, FILETIME: 64, CF: 71, VECTOR: 0x1000 };
const pad4 = (n) => (n + 3) & ~3;

function decoderFor(codepage) {
  const map = { 65001: 'utf-8', 1252: 'windows-1252', 1200: 'utf-16le' };
  try {
    return new TextDecoder(map[codepage] || `windows-${codepage}`);
  } catch {
    return new TextDecoder('windows-1252');
  }
}

function readTyped(buf, pos, type, dec) {
  switch (type) {
    case VT.I2:
      return [buf.readInt16LE(pos), pos + 4];
    case VT.I4:
    case VT.UI4:
      return [buf.readInt32LE(pos), pos + 4];
    case VT.BOOL:
      return [buf.readInt16LE(pos) !== 0, pos + 4];
    case VT.LPSTR: {
      const len = buf.readUInt32LE(pos);
      const s = dec.decode(buf.subarray(pos + 4, pos + 4 + len)).replace(/\0+$/, '');
      return [s, pos + 4 + pad4(len)];
    }
    case VT.LPWSTR: {
      const chars = buf.readUInt32LE(pos);
      const s = buf.toString('utf16le', pos + 4, pos + 4 + chars * 2).replace(/\0+$/, '');
      return [s, pos + 4 + pad4(chars * 2)];
    }
    case VT.FILETIME: {
      const lo = buf.readUInt32LE(pos);
      const hi = buf.readUInt32LE(pos + 4);
      const ms = (hi * 2 ** 32 + lo) / 1e4 - 11644473600000;
      return [new Date(ms), pos + 8];
    }
    case VT.CF: {
      const size = buf.readUInt32LE(pos);
      return [buf.subarray(pos + 4, pos + 4 + size), pos + 4 + pad4(size)];
    }
    case VT.VARIANT: {
      const t = buf.readUInt32LE(pos) & 0xffff;
      return readTyped(buf, pos + 4, t, dec);
    }
    default:
      throw new Error(`Unsupported property type ${type}`);
  }
}

// Returns Map<pid, value> for the first section of a property-set stream.
export function parsePropertySet(buf) {
  if (!buf || buf.length < 48 || buf.readUInt16LE(0) !== 0xfffe) return new Map();
  const secStart = buf.readUInt32LE(44);
  const count = buf.readUInt32LE(secStart + 4);
  const offsets = [];
  for (let i = 0; i < count; i++) {
    offsets.push([buf.readUInt32LE(secStart + 8 + i * 8), buf.readUInt32LE(secStart + 12 + i * 8)]);
  }
  const cpEntry = offsets.find(([pid]) => pid === 1);
  const codepage = cpEntry ? buf.readUInt16LE(secStart + cpEntry[1] + 4) : 1252;
  const dec = decoderFor(codepage);

  const props = new Map();
  for (const [pid, off] of offsets) {
    const pos = secStart + off;
    try {
      const raw = buf.readUInt32LE(pos);
      const type = raw & 0x0fff;
      if (raw & VT.VECTOR) {
        const n = buf.readUInt32LE(pos + 4);
        const items = [];
        let p = pos + 8;
        for (let i = 0; i < n; i++) {
          const [v, next] = readTyped(buf, p, type, dec);
          items.push(v);
          p = next;
        }
        props.set(pid, items);
      } else {
        props.set(pid, readTyped(buf, pos + 4, type, dec)[0]);
      }
    } catch {
      // Skip properties we can't decode; the rest are still useful.
    }
  }
  return props;
}
