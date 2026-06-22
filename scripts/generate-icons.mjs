// Generates the app icons as PNG files with zero external dependencies.
// It draws a glossy "environment sphere" on a dark gradient — a simple,
// on-theme icon for an environment-map app. Run with: node scripts/generate-icons.mjs
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

// --- Icon artwork ------------------------------------------------------------
const mix = (a, b, t) => Math.round(a + (b - a) * t);

function iconPixel(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const ny = y / size;

  // Dark vertical gradient background
  let r = mix(17, 8, ny);
  let g = mix(24, 14, ny);
  let b = mix(58, 31, ny);

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const R = size * 0.34;

  if (dist <= R + 1) {
    const t = Math.min(1, dist / R); // 0 at center, 1 at edge
    // Sphere base color: cyan center fading to deep blue at the rim
    let sr = mix(56, 12, t);
    let sg = mix(189, 40, t);
    let sb = mix(248, 120, t);
    // Specular highlight toward the top-left
    const hlDist = Math.sqrt((dx + R * 0.45) ** 2 + (dy + R * 0.45) ** 2);
    const hl = Math.max(0, 1 - hlDist / (R * 0.9));
    sr = mix(sr, 255, hl * 0.7);
    sg = mix(sg, 255, hl * 0.7);
    sb = mix(sb, 255, hl * 0.7);
    // Soft anti-aliased edge
    const edge = Math.max(0, Math.min(1, (R - dist) / 2));
    r = mix(r, sr, edge);
    g = mix(g, sg, edge);
    b = mix(b, sb, edge);
  }
  return [r, g, b, 255];
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
