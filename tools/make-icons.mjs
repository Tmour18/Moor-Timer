// Erzeugt die App-Icons ohne externe Abhängigkeiten: einfache Vektorformen,
// 4×4-Supersampling, eigener minimaler PNG-Encoder (zlib ist in Node eingebaut).
// Aufruf: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const BG_TOP = [0x26, 0x26, 0x26];
const BG_BOTTOM = [0x18, 0x18, 0x18];
const LIME = [0x99, 0xff, 0x33];
const FACE = [0x1c, 0x1c, 0x1c];

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // Filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** Farbe an Punkt (x, y) in Glyph-Koordinaten 0..1. */
function glyph(x, y) {
  const cx = 0.5;
  const cy = 0.56;
  const R = 0.3;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d <= R) {
    if (d <= 0.032) return LIME; // Mittelpunkt
    if (d <= 0.235) {
      // Ziffernblatt mit Lime-Sektor (12 bis 4 Uhr) wie ein ablaufender Timer.
      let a = Math.atan2(dx, -dy);
      if (a < 0) a += 2 * Math.PI;
      if (d <= 0.2 && a <= (2 * Math.PI) / 3) return LIME;
      return FACE;
    }
    return LIME;
  }
  if (inRoundRect(x, y, 0.465, 0.2, 0.535, 0.28, 0.005)) return LIME; // Hals
  if (inRoundRect(x, y, 0.39, 0.12, 0.61, 0.2, 0.03)) return LIME; // Krone
  // Seitenknopf, um 45° gedreht, oben rechts.
  const ang = -Math.PI / 4;
  const bx = cx + Math.sin(-ang) * (R + 0.045);
  const by = cy - Math.cos(-ang) * (R + 0.045);
  const rx = (x - bx) * Math.cos(ang) - (y - by) * Math.sin(ang);
  const ry = (x - bx) * Math.sin(ang) + (y - by) * Math.cos(ang);
  if (inRoundRect(rx, ry, -0.05, -0.035, 0.05, 0.035, 0.015)) return LIME;
  return null;
}

function render(size, { scale = 1 } = {}) {
  const S = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxx = 0; pxx < size; pxx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = (pxx + (sx + 0.5) / S) / size;
          const v = (py + (sy + 0.5) / S) / size;
          const gx = (u - 0.5) / scale + 0.5;
          const gy = (v - 0.5) / scale + 0.5;
          let c = glyph(gx, gy);
          if (!c) c = BG_TOP.map((t, i) => t + (BG_BOTTOM[i] - t) * v);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const o = (py * size + pxx) * 4;
      px[o] = Math.round(r / (S * S));
      px[o + 1] = Math.round(g / (S * S));
      px[o + 2] = Math.round(b / (S * S));
      px[o + 3] = 255;
    }
  }
  return encodePng(size, size, px);
}

mkdirSync(OUT, { recursive: true });
const jobs = [
  ['apple-touch-icon.png', 180, 0.86],
  ['icon-192.png', 192, 0.86],
  ['icon-512.png', 512, 0.86],
  // Maskable: Motiv innerhalb der sicheren Zone (Kreis mit 80 % Durchmesser).
  ['icon-maskable-512.png', 512, 0.66],
];
for (const [name, size, scale] of jobs) {
  writeFileSync(join(OUT, name), render(size, { scale }));
  console.log('geschrieben:', name);
}
