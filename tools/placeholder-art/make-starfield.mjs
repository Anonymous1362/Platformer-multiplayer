// Generates the placeholder tileable star field (own work) and prints its sha256 for the manifest.
// Usage: node tools/placeholder-art/make-starfield.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

const OUT = new URL('../../public/assets/global/bg_starfield.png', import.meta.url).pathname;
const W = 512;
const H = 512;
const BASE = [0x08, 0x0b, 0x1a]; // Deep Cosmos

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261125);
const px = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i += 1) {
  px[i * 3] = BASE[0];
  px[i * 3 + 1] = BASE[1];
  px[i * 3 + 2] = BASE[2];
}

const tints = [
  [255, 255, 255],
  [219, 234, 254],
  [204, 251, 241],
  [254, 243, 199],
];

for (let s = 0; s < 260; s += 1) {
  const cx = rand() * W;
  const cy = rand() * H;
  const big = rand() < 0.06;
  const r = big ? 1.6 + rand() * 1.4 : 0.6 + rand() * 0.6;
  const alpha = 0.35 + rand() * 0.65;
  const tint = tints[Math.floor(rand() * tints.length)];
  const reach = Math.ceil(r + 1);
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const x = Math.floor(cx) + dx;
      const y = Math.floor(cy) + dy;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const a = alpha * Math.max(0, 1 - d / (r + 0.5));
      if (a <= 0) continue;
      const wx = ((x % W) + W) % W; // wrap so the tile repeats seamlessly
      const wy = ((y % H) + H) % H;
      const i = (wy * W + wx) * 3;
      for (let c = 0; c < 3; c += 1) px[i + c] = px[i + c] + (tint[c] - px[i + c]) * a;
    }
  }
}

const out = Buffer.alloc(W * H * 3);
for (let i = 0; i < out.length; i += 1) out[i] = Math.max(0, Math.min(255, Math.round(px[i])));

mkdirSync(dirname(OUT), { recursive: true });
await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT);
const hash = createHash('sha256').update(readFileSync(OUT)).digest('hex');
console.log(`wrote ${OUT}\nsha256 ${hash}`);
