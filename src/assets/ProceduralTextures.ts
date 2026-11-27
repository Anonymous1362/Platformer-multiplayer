import type Phaser from 'phaser';
import { Random } from '../core/Random';
import { Palette, cssHex } from '../theme/ThemePalette';
import type { AssetManifestEntry } from './AssetTypes';
import { NEO_CELESTIAL_PAINTERS, type Painter, type PainterSpec } from './painters/NeoCelestial';

const DEFAULT_SIZE = 64;

function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/** Tileable star field on Deep Cosmos; stars wrap at the edges. */
const paintStarfield: Painter = (ctx, width, height, rng) => {
  ctx.fillStyle = cssHex(Palette.deepCosmos);
  ctx.fillRect(0, 0, width, height);
  const tints = ['#FFFFFF', '#DBEAFE', '#CCFBF1', '#FEF3C7'] as const;
  for (let i = 0; i < 240; i += 1) {
    const x = rng.nextFloat() * width;
    const y = rng.nextFloat() * height;
    const big = rng.nextFloat() < 0.06;
    const radius = big ? 1.6 + rng.nextFloat() * 1.4 : 0.5 + rng.nextFloat() * 0.7;
    ctx.globalAlpha = 0.35 + rng.nextFloat() * 0.65;
    ctx.fillStyle = tints[rng.nextInt(tints.length)] ?? '#FFFFFF';
    for (const dx of [-width, 0, width]) {
      for (const dy of [-height, 0, height]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
};

/** Soft white dot for glows; tint it in Phaser. */
const paintSoftDot: Painter = (ctx, width, height) => {
  const r = Math.min(width, height) / 2;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, r);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

/** On-palette placeholder for any key without a dedicated painter: never a glaring "missing" texture. */
const paintGeneric: Painter = (ctx, width, height) => {
  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.06));
  const radius = Math.min(width, height) * 0.2;
  ctx.fillStyle = cssHex(Palette.slateHull);
  ctx.strokeStyle = cssHex(Palette.electricCyan);
  ctx.lineWidth = inset;
  ctx.beginPath();
  ctx.roundRect(inset, inset, width - inset * 2, height - inset * 2, radius);
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const PAINTERS: Readonly<Record<string, PainterSpec>> = {
  bg_starfield: { width: 512, height: 512, paint: paintStarfield },
  fx_soft_dot: { width: 64, height: 64, paint: paintSoftDot },
  ...NEO_CELESTIAL_PAINTERS,
};

/** Draws the procedural version of `entry` and adds it to Phaser under `entry.key`. */
export function makeProceduralTexture(
  textures: Phaser.Textures.TextureManager,
  entry: AssetManifestEntry,
): void {
  const spec = PAINTERS[entry.key];
  const declared = entry.files[0];
  const width = spec?.width ?? declared?.width ?? DEFAULT_SIZE;
  const height = spec?.height ?? declared?.height ?? DEFAULT_SIZE;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for procedural textures');
  (spec?.paint ?? paintGeneric)(ctx, width, height, new Random(hashKey(entry.key)));

  if (textures.exists(entry.key)) textures.remove(entry.key);
  const texture = textures.addCanvas(entry.key, canvas);
  const frames = spec?.frames;
  if (texture && frames) {
    const columns = frames.columns ?? frames.count;
    for (let i = 0; i < frames.count; i += 1) {
      const x = (i % columns) * frames.width;
      const y = Math.floor(i / columns) * frames.height;
      texture.add(String(i), 0, x, y, frames.width, frames.height);
    }
  }
}
