// Generates the app icons as PNG files with zero external dependencies.
// Draws the SimplyVoxel mark: a clean isometric voxel (cube) in the site's blue
// family on a dark, full-bleed square (so iOS/Android can mask it into a
// squircle). Run with: node scripts/generate-icons.mjs
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// --- Minimal PNG encoder (RGBA, 8-bit) ---------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePNG(size, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type 6 = RGBA
  const rowLen = size * 4;
  const raw = Buffer.alloc((rowLen + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowLen + 1)] = 0; // filter type 0 for each row
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const o = y * (rowLen + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- Icon artwork: isometric voxel -------------------------------------------
// Geometry in normalised [0,1] coords (matches public/logo.svg), so it scales
// crisply to any icon size.
const T = [0.5, 0.254];
const RM = [0.734, 0.371];
const LM = [0.266, 0.371];
const C = [0.5, 0.488];
const B = [0.5, 0.746];
const RL = [0.734, 0.629];
const LL = [0.266, 0.629];

const FACE_TOP = [T, RM, C, LM];
const FACE_LEFT = [LM, LL, B, C];
const FACE_RIGHT = [RM, RL, B, C];

const COL_TOP = [125, 211, 252];   // #7dd3fc  (lit)
const COL_LEFT = [56, 189, 248];   // #38bdf8  (site accent)
const COL_RIGHT = [14, 127, 184];  // #0e7fb8  (shaded)
const COL_BG = [11, 16, 32];       // #0b1020

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function sampleColor(nx, ny) {
  if (inPoly(nx, ny, FACE_TOP)) return COL_TOP;
  if (inPoly(nx, ny, FACE_LEFT)) return COL_LEFT;
  if (inPoly(nx, ny, FACE_RIGHT)) return COL_RIGHT;
  return COL_BG;
}

const SS = 4; // supersampling for smooth anti-aliased edges

function iconPixel(x, y, size) {
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < SS; i++)
    for (let j = 0; j < SS; j++) {
      const nx = (x + (i + 0.5) / SS) / size;
      const ny = (y + (j + 0.5) / SS) / size;
      const c = sampleColor(nx, ny);
      r += c[0]; g += c[1]; b += c[2];
    }
  const n = SS * SS;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255];
}

// --- Write the files ---------------------------------------------------------
const outDir = new URL('../public/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const targets = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32x32.png', 32],
];

for (const [name, size] of targets) {
  const png = makePNG(size, iconPixel);
  writeFileSync(new URL(name, outDir), png);
  console.log(`wrote public/${name} (${size}x${size}, ${png.length} bytes)`);
}
