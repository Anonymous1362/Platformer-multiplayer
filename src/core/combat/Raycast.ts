import { tileFlags } from '../Collision';
import { GameConfig } from '../GameConfig';
import { TileFlag, type Level } from '../level/LevelTypes';

/**
 * Segment queries for projectiles and line of sight (spec 4.2, N3). Projectiles are swept: every tick
 * the segment from the old to the new position is tested, so no speed passes through anything.
 */

const TILE = GameConfig.world.tileSizeU;
/** A segment longer than this many tiles is a bug; stop walking rather than loop. */
const MAX_TILE_STEPS = 512;

/**
 * Fraction t in [0, 1] along (x0, y0) → (x1, y1) where the segment first enters a solid tile, or null.
 * A start point inside a solid tile returns 0. Grid walk (Amanatides–Woo), exact for straight lines.
 */
export function raycastTiles(level: Level, x0: number, y0: number, x1: number, y1: number): number | null {
  let col = Math.floor(x0 / TILE);
  let row = Math.floor(y0 / TILE);
  const solid = (c: number, r: number): boolean => (tileFlags(level, c, r) & TileFlag.Solid) !== 0;
  if (solid(col, row)) return 0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepC = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepR = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = stepC === 0 ? Number.POSITIVE_INFINITY : TILE / Math.abs(dx);
  const tDeltaY = stepR === 0 ? Number.POSITIVE_INFINITY : TILE / Math.abs(dy);
  let tMaxX =
    stepC === 0 ? Number.POSITIVE_INFINITY : ((stepC > 0 ? (col + 1) * TILE : col * TILE) - x0) / dx;
  let tMaxY =
    stepR === 0 ? Number.POSITIVE_INFINITY : ((stepR > 0 ? (row + 1) * TILE : row * TILE) - y0) / dy;
  for (let i = 0; i < MAX_TILE_STEPS; i += 1) {
    let t: number;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      col += stepC;
      tMaxX += tDeltaX;
    } else {
      t = tMaxY;
      row += stepR;
      tMaxY += tDeltaY;
    }
    if (t > 1) return null;
    if (solid(col, row)) return Math.max(0, t);
  }
  return null;
}

/** Fraction t in [0, 1] where the segment enters the open box, 0 if it starts inside, or null. */
export function segmentBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): number | null {
  if (x0 > left && x0 < right && y0 > top && y0 < bottom) return 0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tEnter = 0;
  let tExit = 1;
  for (const [p, d, lo, hi] of [
    [x0, dx, left, right],
    [y0, dy, top, bottom],
  ] as const) {
    if (d === 0) {
      if (p <= lo || p >= hi) return null;
      continue;
    }
    let a = (lo - p) / d;
    let b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    tEnter = Math.max(tEnter, a);
    tExit = Math.min(tExit, b);
    if (tEnter >= tExit) return null;
  }
  return tEnter;
}

/** Clear line between two points (tiles only; platforms and bodies never block sight). */
export function lineOfSight(level: Level, x0: number, y0: number, x1: number, y1: number): boolean {
  return raycastTiles(level, x0, y0, x1, y1) === null;
}
