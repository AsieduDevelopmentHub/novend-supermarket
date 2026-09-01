/** Uncompressed ZIP (STORE) writer/reader for XLSX without extra dependencies. */

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export type ZipEntry = { name: string; data: Uint8Array };

export function createStoreZip(entries: ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      entry.data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralBlob = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBlob.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralBlob, eocd]);
}

function readU16(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readU32(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0
  );
}

const MAX_ZIP_FILES = 64;
const MAX_UNCOMPRESSED = 20 * 1024 * 1024;

export function readStoreZip(buf: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  const decoder = new TextDecoder();
  let uncompressed = 0;

  while (offset + 30 <= buf.length && files.size < MAX_ZIP_FILES) {
    const sig = readU32(buf, offset);
    if (sig !== 0x04034b50) break;
    const method = readU16(buf, offset + 8);
    const compSize = readU32(buf, offset + 18);
    const uncompSize = readU32(buf, offset + 22);
    const nameLen = readU16(buf, offset + 26);
    const extraLen = readU16(buf, offset + 28);
    const nameStart = offset + 30;
    const name = decoder.decode(buf.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) {
      throw new Error("This spreadsheet looks damaged. Export it as CSV and try again.");
    }
    if (method !== 0) {
      throw new Error(
        "This Excel file uses compression Novend cannot read here. Save as CSV or download the Novend template.",
      );
    }
    uncompressed += uncompSize;
    if (uncompressed > MAX_UNCOMPRESSED) {
      throw new Error("This spreadsheet is too large to import safely.");
    }
    files.set(name, buf.subarray(dataStart, dataEnd));
    offset = dataEnd;
  }
  if (files.size === 0) {
    throw new Error("Could not read this spreadsheet. Save it as CSV and try again.");
  }
  return files;
}
