import { GameConfig } from './GameConfig';
import { TileFlag, type Level } from './level/LevelTypes';
import type { PlatformState } from './SimulationTypes';

const TILE = GameConfig.world.tileSizeU;
const STANDABLE = TileFlag.Solid | TileFlag.OneWay;

/**
 * Distance from a point (usually a body's feet) straight down to the first standable surface: a solid
 * or one-way tile top, or a platform top. Reads only; never changes state. The renderer uses it for
 * contact shadows (spec 9.3), so it is part of the simulation's read API rather than a render guess.
 * Samples the center and both edges of `halfWidth`. Returns null when nothing is within `maxU`.
 */
export function groundDistance(
  level: Level,
  platforms: readonly PlatformState[],
  x: number,
  y: number,
  halfWidth: number,
  maxU: number,
): number | null {
  let best: number | null = null;
  const firstRow = Math.max(0, Math.floor(y / TILE));
  const lastRow = Math.min(level.heightTiles - 1, Math.floor((y + maxU) / TILE));
  for (const sx of [x - halfWidth, x, x + halfWidth]) {
    const col = Math.floor(sx / TILE);
    if (col < 0 || col >= level.widthTiles) continue;
    for (let row = firstRow; row <= lastRow; row += 1) {
      const top = row * TILE;
      if (top < y - 0.5) continue; // a tile the point is inside is not "below" it
      if (((level.tiles[row * level.widthTiles + col] ?? 0) & STANDABLE) === 0) continue;
      const d = top - y;
      if (best === null || d < best) best = d;
      break;
    }
  }
  for (let i = 0; i < platforms.length; i += 1) {
    const p = platforms[i];
    const def = level.platforms[i];
    if (!p || !def || x + halfWidth <= p.x || x - halfWidth >= p.x + def.w) continue;
    const d = p.y - y;
    if (d < -0.5 || d > maxU) continue;
    if (best === null || d < best) best = d;
  }
  return best === null ? null : Math.max(0, best);
}
