import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync, inflateRawSync } from 'node:zlib';
import { demand, MAX_BYTES } from './stats-chart-contract.mjs';
export const hash = data => createHash('sha256').update(data).digest('hex');
export function safePath(name) {
  demand(typeof name === 'string' && /^[a-zA-Z0-9._/-]+$/.test(name) && name.length <= 99 &&
    !name.startsWith('/') && name.split('/').every(part => part && part !== '.' && part !== '..'), 'unsafe-archive-path');
  return name;
}
function octal(buffer, start, length) {
  const raw = buffer.subarray(start, start + length).toString('ascii').replace(/\0.*$/, '').trim();
  demand(/^[0-7]+$/.test(raw), 'invalid-tar-number');
  return parseInt(raw, 8);
}
// Deliberately small USTAR subset: regular files only, no links, PAX, GNU extensions or directories.
export function packTar(files) {
  const chunks = [];
  for (const [name, bytes] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    safePath(name);
    demand(Buffer.isBuffer(bytes) && bytes.length <= MAX_BYTES, 'package-too-large');
    const header = Buffer.alloc(512);
    const field = (offset, length, number) => header.write(number.toString(8).padStart(length - 1, '0') + '\0', offset, length, 'ascii');
    header.write(name); field(100, 8, name.endsWith('.sh') ? 0o555 : 0o444);
    field(108, 8, 0); field(116, 8, 0); field(124, 12, bytes.length); field(136, 12, 0);
    header.fill(32, 148, 156); header[156] = 48; header.write('ustar\0', 257); header.write('00', 263);
    field(148, 8, header.reduce((sum, byte) => sum + byte, 0));
    chunks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  const plain = Buffer.concat(chunks);
  demand(plain.length <= MAX_BYTES, 'package-too-large');
  return gzipSync(plain, { level: 9 });
}
export function unpackTar(archive) {
  demand(archive.length <= MAX_BYTES, 'package-too-large');
  const bytes = gunzipSync(archive, { maxOutputLength: MAX_BYTES });
  const files = new Map(); let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512); offset += 512;
    if (header.every(byte => byte === 0)) {
      demand(bytes.length >= offset + 512 && bytes.subarray(offset).every(byte => byte === 0), 'invalid-tar-end');
      return files;
    }
    const check = Buffer.from(header); check.fill(32, 148, 156);
    demand(octal(header, 148, 8) === check.reduce((sum, byte) => sum + byte, 0), 'invalid-tar-checksum');
    demand(header.subarray(257, 263).toString() === 'ustar\0' && header[156] === 48 &&
      header.subarray(157, 257).every(byte => byte === 0) && header.subarray(345, 500).every(byte => byte === 0),
    'unsafe-tar-type');
    const name = safePath(header.subarray(0, 100).toString('utf8').replace(/\0.*$/, ''));
    demand(!files.has(name), 'duplicate-archive-path');
    demand([0o444, 0o555].includes(octal(header, 100, 8)), 'unsafe-tar-mode');
    const size = octal(header, 124, 12);
    demand(size <= MAX_BYTES && offset + Math.ceil(size / 512) * 512 <= bytes.length, 'truncated-tar');
    files.set(name, bytes.subarray(offset, offset + size)); offset += Math.ceil(size / 512) * 512;
    demand(files.size <= 64, 'too-many-package-files');
  }
  throw new Error('invalid-tar-end');
}
// Read the GitHub Actions ZIP in memory, before any filesystem extraction. Central directory
// controls lengths (upload-artifact uses data descriptors); reject links and ZIP64/encryption.
export function unpackArtifactZip(bytes) {
  demand(bytes.length <= MAX_BYTES && bytes.length >= 22, 'invalid-artifact-zip');
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  demand(end >= 0 && end + 22 + bytes.readUInt16LE(end + 20) === bytes.length, 'invalid-artifact-zip');
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12);
  let offset = bytes.readUInt32LE(end + 16);
  demand(count === 3 && bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 &&
    bytes.readUInt16LE(end + 8) === count && offset + size === end, 'invalid-artifact-zip');
  const files = new Map(); let total = 0;
  for (let i = 0; i < count; i++) {
    demand(offset + 46 <= end && bytes.readUInt32LE(offset) === 0x02014b50, 'invalid-artifact-zip');
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20), plain = bytes.readUInt32LE(offset + 24);
    const nameSize = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32);
    const mode = bytes.readUInt32LE(offset + 38) >>> 16, local = bytes.readUInt32LE(offset + 42);
    total += plain;
    demand(offset + 46 + nameSize + extra + comment <= end, 'invalid-artifact-zip');
    const name = safePath(bytes.subarray(offset + 46, offset + 46 + nameSize).toString('utf8'));
    demand(['runtime.tgz', 'manifest.json', 'release-authorization.json'].includes(name) && !files.has(name) &&
      !(flags & 1) && [0, 8].includes(method) && [0, 0o100000].includes(mode & 0o170000) &&
      total <= MAX_BYTES && plain <= MAX_BYTES && compressed <= MAX_BYTES && local + 30 <= bytes.length && bytes.readUInt32LE(local) === 0x04034b50,
    'unsafe-artifact-zip');
    const localNameSize = bytes.readUInt16LE(local + 26), localExtra = bytes.readUInt16LE(local + 28);
    demand(bytes.subarray(local + 30, local + 30 + localNameSize).toString('utf8') === name &&
      bytes.readUInt16LE(local + 8) === method, 'invalid-artifact-zip');
    const start = local + 30 + localNameSize + localExtra;
    demand(start + compressed <= bytes.readUInt32LE(end + 16), 'invalid-artifact-zip');
    const data = bytes.subarray(start, start + compressed);
    const result = method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_BYTES }) : data;
    demand(result.length === plain, 'invalid-artifact-zip');
    files.set(name, result); offset += 46 + nameSize + extra + comment;
  }
  demand(offset === end, 'invalid-artifact-zip');
  return files;
}
