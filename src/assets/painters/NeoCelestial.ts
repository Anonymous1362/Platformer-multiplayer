import type { Random } from '../../core/Random';
import { cssHex, Palette } from '../../theme/ThemePalette';

/**
 * Procedural Neo-Celestial art (spec 9.1–9.3): the built-in look until custom or AI art replaces a key
 * through the manifest. Canvas 2D only (gradients allowed). One key light from the upper left, cool
 * ambient fill, restrained emissive accents, broad shapes with rounded bevels, no thin detail.
 * Every painter is deterministic: it draws from its own seeded generator.
 */

export type Painter = (ctx: CanvasRenderingContext2D, width: number, height: number, rng: Random) => void;

export interface PainterSpec {
  readonly width: number;
  readonly height: number;
  readonly paint: Painter;
  /** A horizontal strip of equal frames, named "0", "1", ... (spinners and flipbooks). */
  readonly frames?: { readonly width: number; readonly height: number; readonly count: number };
}

function rgba(hex: number, alpha: number): string {
  return `rgba(${String((hex >> 16) & 0xff)},${String((hex >> 8) & 0xff)},${String(hex & 0xff)},${String(alpha)})`;
}

/** Draws `draw` three times, shifted by the width, so the texture tiles horizontally. */
function wrapX(width: number, draw: (dx: number) => void): void {
  for (const dx of [-width, 0, width]) draw(dx);
}

function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Layer 1 (depth 0.05): deep nebula sky, tileable both ways. */
const nebula: Painter = (ctx, w, h, rng) => {
  ctx.fillStyle = cssHex(Palette.deepCosmos);
  ctx.fillRect(0, 0, w, h);
  const colors = [Palette.nebulaViolet, Palette.abyssalNavy, 0x1d4ed8, 0x7e22ce] as const;
  for (let i = 0; i < 18; i += 1) {
    const x = rng.nextFloat() * w;
    const y = rng.nextFloat() * h;
    const r = 120 + rng.nextFloat() * 260;
    const color = colors[rng.nextInt(colors.length)] ?? Palette.abyssalNavy;
    const alpha = 0.05 + rng.nextFloat() * 0.12;
    wrapX(w, (dx) => {
      for (const dy of [-h, 0, h]) softBlob(ctx, x + dx, y + dy, r, color, alpha);
    });
  }
};

/** Layer 3 (depth 0.25): faint aurora dust bands, tileable both ways. */
const dust: Painter = (ctx, w, h, rng) => {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 10; i += 1) {
    const y = rng.nextFloat() * h;
    const thickness = 30 + rng.nextFloat() * 70;
    const color = rng.nextFloat() < 0.5 ? Palette.electricCyan : Palette.nebulaViolet;
    const alpha = 0.025 + rng.nextFloat() * 0.035;
    const tilt = (rng.nextFloat() - 0.5) * 0.25;
    wrapX(w, (dx) => {
      for (const dy of [-h, 0, h]) {
        ctx.save();
        ctx.translate(dx + w / 2, y + dy);
        ctx.rotate(tilt);
        const g = ctx.createLinearGradient(0, -thickness, 0, thickness);
        g.addColorStop(0, rgba(color, 0));
        g.addColorStop(0.5, rgba(color, alpha));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-w, -thickness, w * 2, thickness * 2);
        ctx.restore();
      }
    });
  }
};

/** Layer 4 (depth 0.45): megastructure silhouettes along the bottom, tileable horizontally. */
const megastructure: Painter = (ctx, w, h, rng) => {
  ctx.clearRect(0, 0, w, h);
  let x = 0;
  while (x < w) {
    const width = 60 + rng.nextFloat() * 160;
    const height = h * (0.25 + rng.nextFloat() * 0.6);
    const kind = rng.nextInt(3);
    const left = x;
    wrapX(w, (dx) => {
      const bx = left + dx;
      const g = ctx.createLinearGradient(0, h - height, 0, h);
      g.addColorStop(0, rgba(Palette.slateHull, 0.95));
      g.addColorStop(1, rgba(Palette.abyssalNavy, 1));
      ctx.fillStyle = g;
      ctx.beginPath();
      if (kind === 0) {
        // Chevron-topped tower.
        ctx.moveTo(bx, h);
        ctx.lineTo(bx, h - height * 0.85);
        ctx.lineTo(bx + width / 2, h - height);
        ctx.lineTo(bx + width, h - height * 0.85);
        ctx.lineTo(bx + width, h);
      } else if (kind === 1) {
        // Stepped block.
        ctx.moveTo(bx, h);
        ctx.lineTo(bx, h - height * 0.6);
        ctx.lineTo(bx + width * 0.3, h - height * 0.6);
        ctx.lineTo(bx + width * 0.3, h - height);
        ctx.lineTo(bx + width * 0.8, h - height);
        ctx.lineTo(bx + width * 0.8, h - height * 0.7);
        ctx.lineTo(bx + width, h - height * 0.7);
        ctx.lineTo(bx + width, h);
      } else {
        // Ring arch (Aurai arcs).
        ctx.moveTo(bx, h);
        ctx.arc(bx + width / 2, h - height * 0.55, width / 2, Math.PI, 0);
        ctx.lineTo(bx + width, h);
      }
      ctx.closePath();
      ctx.fill();
      // Upper-left key light: a thin lit edge on the left side of each silhouette.
      ctx.fillStyle = rgba(Palette.coolSteel, 0.18);
      ctx.fillRect(bx, h - height * 0.82, 3, height * 0.82);
      // Sparse window lights.
      for (let i = 0; i < 4; i += 1) {
        const wx = bx + 10 + ((i * 37) % Math.max(20, width - 20));
        const wy = h - height * (0.2 + 0.15 * i);
        ctx.fillStyle = rgba(i % 2 === 0 ? Palette.electricCyan : Palette.starlightGold, 0.35);
        ctx.fillRect(wx, wy, 4, 4);
      }
    });
    x += width + 20 + rng.nextFloat() * 80;
  }
};

/**
 * Player suit, light neutral so slot colors can tint it (body only; details are a second layer).
 * Feet sit on the bottom edge; the helmet top is 90 px up, just above the 88 u collider.
 */
const playerSuit: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(cx - 14, h - 30, 12, 30, 5); // back leg
  ctx.roundRect(cx + 2, h - 30, 12, 30, 5); // front leg
  ctx.roundRect(cx - 18, h - 62, 36, 38, 12); // torso
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, h - 71, 19, 0, Math.PI * 2); // helmet
  ctx.fill();
  // Key light from the upper left: a soft highlight; shade on the right.
  const shade = ctx.createLinearGradient(cx - 22, h - 90, cx + 22, h);
  shade.addColorStop(0, 'rgba(255,255,255,0.28)');
  shade.addColorStop(1, 'rgba(15,23,42,0.38)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
};

/** Player details (untinted): visor facing +x, jetpack on the back, belt, boots. */
const playerDetail: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  ctx.fillStyle = cssHex(Palette.titaniumGunmetal);
  ctx.beginPath();
  ctx.roundRect(cx - 28, h - 64, 12, 30, 5); // jetpack
  ctx.fill();
  ctx.fillStyle = cssHex(Palette.starlightGold);
  ctx.fillRect(cx - 26, h - 37, 8, 4); // nozzle
  const visor = ctx.createLinearGradient(cx, h - 82, cx + 18, h - 64);
  visor.addColorStop(0, cssHex(Palette.abyssalNavy));
  visor.addColorStop(1, cssHex(Palette.deepCosmos));
  ctx.fillStyle = visor;
  ctx.beginPath();
  ctx.roundRect(cx - 1, h - 80, 19, 15, 7);
  ctx.fill();
  ctx.fillStyle = rgba(Palette.electricCyan, 0.9);
  ctx.fillRect(cx + 5, h - 77, 8, 3); // visor glint
  ctx.fillStyle = cssHex(Palette.titaniumGunmetal);
  ctx.fillRect(cx - 18, h - 31, 36, 5); // belt
  ctx.fillRect(cx - 15, h - 7, 13, 7); // boots
  ctx.fillRect(cx + 2, h - 7, 13, 7);
};

/** Crawler: armored beetle shell over stubby legs, facing +x. */
const crawler: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cssHex(Palette.titaniumGunmetal);
  for (const lx of [10, 24, 42, 56]) {
    ctx.beginPath();
    ctx.roundRect(lx, h - 14, 8, 14, 3);
    ctx.fill();
  }
  const shell = ctx.createLinearGradient(0, 4, 0, h - 10);
  shell.addColorStop(0, '#C084FC');
  shell.addColorStop(1, '#6B21A8');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 16, w / 2 - 2, h / 2 - 6, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Segment seams (Custodian curves).
  ctx.strokeStyle = rgba(Palette.deepCosmos, 0.45);
  ctx.lineWidth = 3;
  for (const sx of [0.38, 0.62]) {
    ctx.beginPath();
    ctx.arc(w * sx, h - 16, h / 2 - 8, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // Upper-left highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(w * 0.36, h * 0.38, 12, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
};

const softDot: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  softBlob(ctx, w / 2, h / 2, Math.min(w, h) / 2, 0xffffff, 1);
};

/** Frames in the Star Shard rotation strip (spec 9.3: pre-rendered 24-frame spinners). */
export const SHARD_FRAMES = 24;

/** Star Shard rotation strip: a faceted gold diamond turning about its vertical axis, 24 frames. */
const shardStrip: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const size = h;
  for (let i = 0; i < SHARD_FRAMES; i += 1) {
    const ox = i * size;
    const cx = ox + size / 2;
    const cy = size / 2;
    const c = Math.cos((i / SHARD_FRAMES) * Math.PI * 2);
    const half = Math.max(2, Math.abs(c) * (size / 2 - 6));
    softBlob(ctx, cx, cy, size / 2, Palette.starlightGold, 0.3);
    // Two facets: the one turned toward the upper-left key light is bright.
    const litLeft = c > 0;
    ctx.fillStyle = litLeft ? '#FFE8A3' : cssHex(Palette.starlightGold);
    ctx.beginPath();
    ctx.moveTo(cx, 3);
    ctx.lineTo(cx, size - 3);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = litLeft ? cssHex(Palette.starlightGold) : '#C98A00';
    ctx.beginPath();
    ctx.moveTo(cx, 3);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, size - 3);
    ctx.closePath();
    ctx.fill();
  }
};

/** Plasma bolt: a bright core with a soft cyan glow, pointing +x. */
const bolt: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, rgba(Palette.electricCyan, 0));
  g.addColorStop(0.6, rgba(Palette.electricCyan, 0.8));
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, h / 2 - 4, w, 8, 4);
  ctx.fill();
};

/** Contact shadow: a soft dark ellipse. */
const shadow: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.scale(1, h / w);
  softBlob(ctx, w / 2, w / 2, w / 2, 0x000000, 0.65);
  ctx.restore();
};

/** Slab side face: a dark vertical strip, lighter toward the front edge (x = 0). */
const terrainSide: Painter = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, cssHex(Palette.titaniumGunmetal));
  g.addColorStop(1, cssHex(Palette.abyssalNavy));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/** Slab top (recessed back face): lit lip at the bottom (front), darker toward the back. */
const terrainTop: Painter = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, cssHex(Palette.abyssalNavy));
  g.addColorStop(0.75, cssHex(Palette.titaniumGunmetal));
  g.addColorStop(1, cssHex(Palette.coolSteel));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/** A thin ring for shockwaves, checkpoints, and the exit portal. */
const ring: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(3, w * 0.06);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
};

/** A vertical light beam (checkpoints): bright core, soft sides, fading toward the top. */
const beam: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const across = ctx.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const up = ctx.createLinearGradient(0, h, 0, 0);
  up.addColorStop(0, 'rgba(0,0,0,1)');
  up.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = up;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
};

/** Screen-edge vignette, white so the scene tints it (damage flash, low-HP pulse). */
const vignette: Painter = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const NEO_CELESTIAL_PAINTERS: Readonly<Record<string, PainterSpec>> = {
  bg_nebula: { width: 1024, height: 1024, paint: nebula },
  bg_dust: { width: 1024, height: 1024, paint: dust },
  bg_megastructure: { width: 1024, height: 512, paint: megastructure },
  char_player_suit: { width: 64, height: 104, paint: playerSuit },
  char_player_detail: { width: 64, height: 104, paint: playerDetail },
  enemy_crawler: { width: 72, height: 52, paint: crawler },
  pickup_shard: {
    width: 32 * SHARD_FRAMES,
    height: 32,
    paint: shardStrip,
    frames: { width: 32, height: 32, count: SHARD_FRAMES },
  },
  fx_bolt: { width: 44, height: 12, paint: bolt },
  fx_glow: { width: 64, height: 64, paint: softDot },
  fx_shadow: { width: 64, height: 20, paint: shadow },
  fx_ring: { width: 96, height: 96, paint: ring },
  fx_beam: { width: 64, height: 256, paint: beam },
  fx_vignette: { width: 256, height: 256, paint: vignette },
  terrain_side: { width: 24, height: 64, paint: terrainSide },
  terrain_top: { width: 64, height: 16, paint: terrainTop },
};
