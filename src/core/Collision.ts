import { GameConfig } from './GameConfig';
import { TileFlag, type Level } from './level/LevelTypes';
import type { PlatformState } from './SimulationTypes';

/**
 * Axis-separated collision against the tile grid and kinematic platforms (spec section 13.5, N1–N3).
 * Bodies are axis-aligned boxes anchored at bottom-center (`x`, feet `y`). Overlaps use open intervals:
 * touching an edge is not overlapping, so a body resting on a tile top or against a wall is free.
 * Columns outside the level and rows above it are solid; rows below it are empty (a pit).
 */

const TILE = GameConfig.world.tileSizeU;
const C = GameConfig.collision;
const P = GameConfig.player;
/** Feet within this distance of a tile top count as standing on it (positions snap exactly on landing). */
const TILE_SUPPORT_EPS = 1e-6;

export interface CollisionWorld {
  readonly level: Level;
  readonly platforms: readonly PlatformState[];
}

export interface BodySize {
  readonly halfW: number;
  readonly height: number;
}

export const PLAYER_SIZE: BodySize = { halfW: P.colliderU.width / 2, height: P.colliderU.height };

export function tileFlags(level: Level, col: number, row: number): number {
  if (col < 0 || col >= level.widthTiles || row < 0) return TileFlag.Solid;
  if (row >= level.heightTiles) return 0;
  return level.tiles[row * level.widthTiles + col] ?? 0;
}

interface Extents {
  hit: boolean;
  minLeft: number;
  maxRight: number;
  minTop: number;
  maxBottom: number;
}

/** Every solid tile and solid platform overlapping the open rectangle, summarized by its extreme edges. */
function solidExtents(
  world: CollisionWorld,
  left: number,
  top: number,
  right: number,
  bottom: number,
  ignorePlatform: number,
  includePlatforms = true,
): Extents {
  const e: Extents = {
    hit: false,
    minLeft: Number.POSITIVE_INFINITY,
    maxRight: Number.NEGATIVE_INFINITY,
    minTop: Number.POSITIVE_INFINITY,
    maxBottom: Number.NEGATIVE_INFINITY,
  };
  const c0 = Math.floor(left / TILE);
  const c1 = Math.ceil(right / TILE) - 1;
  const r0 = Math.floor(top / TILE);
  const r1 = Math.ceil(bottom / TILE) - 1;
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      if ((tileFlags(world.level, col, row) & TileFlag.Solid) === 0) continue;
      e.hit = true;
      e.minLeft = Math.min(e.minLeft, col * TILE);
      e.maxRight = Math.max(e.maxRight, (col + 1) * TILE);
      e.minTop = Math.min(e.minTop, row * TILE);
      e.maxBottom = Math.max(e.maxBottom, (row + 1) * TILE);
    }
  }
  if (!includePlatforms) return e;
  world.platforms.forEach((p, i) => {
    const def = world.level.platforms[i];
    if (!def || def.oneWay || i === ignorePlatform) return;
    if (left < p.x + def.w && right > p.x && top < p.y + def.h && bottom > p.y) {
      e.hit = true;
      e.minLeft = Math.min(e.minLeft, p.x);
      e.maxRight = Math.max(e.maxRight, p.x + def.w);
      e.minTop = Math.min(e.minTop, p.y);
      e.maxBottom = Math.max(e.maxBottom, p.y + def.h);
    }
  });
  return e;
}

/** True when the body overlaps any solid tile or solid platform (used for crush checks). */
export function overlapsSolid(
  world: CollisionWorld,
  x: number,
  feetY: number,
  size: BodySize = PLAYER_SIZE,
  ignorePlatform = -1,
): boolean {
  return solidExtents(world, x - size.halfW, feetY - size.height, x + size.halfW, feetY, ignorePlatform).hit;
}

function clampStep(remaining: number): number {
  return Math.max(-C.maxStepU, Math.min(C.maxStepU, remaining));
}

/** No single move may exceed 64 sub-steps (2048 u); anything larger is a bug, not a speed. */
const MAX_MOVE_U = C.maxStepU * 64;

/**
 * Non-finite displacements pass straight through (the N11 assertion reports them) instead of looping
 * forever; finite ones are capped so a runaway value cannot stall a tick.
 */
function boundedMove(d: number): number {
  if (!Number.isFinite(d)) return d;
  return Math.max(-MAX_MOVE_U, Math.min(MAX_MOVE_U, d));
}

export interface MoveXResult {
  readonly x: number;
  readonly y: number;
  readonly blocked: boolean;
  /** Ledge forgiveness lifted the body onto a ledge (spec 4.1). */
  readonly ledge: boolean;
}

export interface MoveXOptions {
  readonly ledgeForgiveness: boolean;
  readonly ignorePlatform?: number;
  readonly size?: BodySize;
}

/**
 * Moves along X and resolves against solids (N1). Steps longer than `maxStepU` are split (N3), so no
 * speed can skip a tile. When blocked, ledge forgiveness lifts the body onto a ledge whose top is at
 * most `ledgeForgivenessU` above the feet if the raised box is free; otherwise the body stops flush.
 */
export function moveX(
  world: CollisionWorld,
  x: number,
  y: number,
  dx: number,
  options: MoveXOptions,
): MoveXResult {
  const size = options.size ?? PLAYER_SIZE;
  const ignore = options.ignorePlatform ?? -1;
  let cx = x;
  let cy = y;
  let ledge = false;
  let remaining = boundedMove(dx);
  if (!Number.isFinite(remaining)) return { x: x + remaining, y, blocked: false, ledge };
  while (remaining !== 0) {
    const step = clampStep(remaining);
    remaining -= step;
    const nx = cx + step;
    const e = solidExtents(world, nx - size.halfW, cy - size.height, nx + size.halfW, cy, ignore);
    if (!e.hit) {
      cx = nx;
      continue;
    }
    if (options.ledgeForgiveness) {
      const rise = cy - e.minTop;
      if (rise > 0 && rise <= P.ledgeForgivenessU) {
        const ly = e.minTop;
        if (!solidExtents(world, nx - size.halfW, ly - size.height, nx + size.halfW, ly, ignore).hit) {
          cx = nx;
          cy = ly;
          ledge = true;
          continue;
        }
      }
    }
    // Stop flush against the blocker, never moving backwards (a body already overlapping stays put).
    cx = step > 0 ? Math.max(cx, e.minLeft - size.halfW) : Math.min(cx, e.maxRight + size.halfW);
    return { x: cx, y: cy, blocked: true, ledge };
  }
  return { x: cx, y: cy, blocked: false, ledge };
}

export interface MoveYResult {
  readonly x: number;
  readonly y: number;
  /** Moving down, the feet met a surface and were placed on it. */
  readonly landed: boolean;
  /** Moving platform landed on, or -1. */
  readonly platform: number;
  /** Moving up, the head met a ceiling that corner correction could not slip past. */
  readonly bonked: boolean;
  /** Sideways nudge applied by corner correction. */
  readonly cornerShift: number;
}

export interface MoveYOptions {
  /** Drop-through grace: one-way tiles and platforms are not surfaces (N2). */
  readonly ignoreOneWay: boolean;
  readonly cornerCorrection: boolean;
  /** Corner-correction tie-breaker when both sides need the same nudge. */
  readonly preferDir: 1 | -1;
  readonly ignorePlatform?: number;
  readonly size?: BodySize;
}

/**
 * Moves along Y and resolves (N1, N2). Down: lands on the highest surface reached — solid tiles and
 * solid platforms by overlap, one-way tiles and platforms by a crossing test (feet at or above the top
 * before, at or below it after, with a 6 u snap tolerance), which cannot tunnel at any speed.
 * Up: one-way surfaces never block; a ceiling corner within `cornerCorrectionU` is slipped past
 * sideways if the nudged box is free at both heights (it never pushes into walls), otherwise the head
 * stops flush.
 */
export function moveY(
  world: CollisionWorld,
  x: number,
  y: number,
  dy: number,
  options: MoveYOptions,
): MoveYResult {
  const size = options.size ?? PLAYER_SIZE;
  const ignore = options.ignorePlatform ?? -1;
  let cx = x;
  let cy = y;
  let cornerShift = 0;
  let remaining = boundedMove(dy);
  if (!Number.isFinite(remaining)) {
    return { x, y: y + remaining, landed: false, platform: -1, bonked: false, cornerShift };
  }
  let firstStep = true;
  while (remaining !== 0) {
    const step = clampStep(remaining);
    remaining -= step;
    const ny = cy + step;
    const left = cx - size.halfW;
    const right = cx + size.halfW;
    if (step > 0) {
      // Static solid tiles by overlap; static ground wins ties with platforms (no surprise carrying).
      const tiles = solidExtents(world, left, ny - size.height, right, ny, ignore, false);
      let best = tiles.hit ? tiles.minTop : Number.POSITIVE_INFINITY;
      let bestPlatform = -1;
      if (!options.ignoreOneWay) {
        const firstRow = Math.max(0, Math.ceil((cy - C.oneWaySnapU) / TILE));
        const lastRow = Math.min(world.level.heightTiles - 1, Math.floor(ny / TILE));
        const c0 = Math.floor(left / TILE);
        const c1 = Math.ceil(right / TILE) - 1;
        for (let row = firstRow; row <= lastRow && row * TILE < best; row += 1) {
          for (let col = c0; col <= c1; col += 1) {
            if ((tileFlags(world.level, col, row) & TileFlag.OneWay) !== 0) {
              best = row * TILE;
              break;
            }
          }
        }
      }
      world.platforms.forEach((p, i) => {
        const def = world.level.platforms[i];
        if (!def || i === ignore || !(left < p.x + def.w && right > p.x)) return;
        let hit: boolean;
        if (def.oneWay) {
          // Crossing test relative to the platform, which may have moved this tick.
          const prevTop = firstStep ? p.prevY : p.y;
          hit = !options.ignoreOneWay && cy - prevTop <= C.oneWaySnapU && ny - p.y >= 0;
        } else {
          hit = ny > p.y && ny - size.height < p.y + def.h;
        }
        if (hit && p.y < best) {
          best = p.y;
          bestPlatform = i;
        }
      });
      if (best !== Number.POSITIVE_INFINITY) {
        return { x: cx, y: best, landed: true, platform: bestPlatform, bonked: false, cornerShift };
      }
      cy = ny;
    } else {
      const e = solidExtents(world, left, ny - size.height, right, ny, ignore);
      if (!e.hit) {
        cy = ny;
        firstStep = false;
        continue;
      }
      if (options.cornerCorrection) {
        const shift = cornerNudge(world, cx, cy, ny, e, size, ignore, options.preferDir);
        if (shift !== 0) {
          cx += shift;
          cornerShift += shift;
          cy = ny;
          firstStep = false;
          continue;
        }
      }
      return {
        x: cx,
        y: Math.min(cy, e.maxBottom + size.height),
        landed: false,
        platform: -1,
        bonked: true,
        cornerShift,
      };
    }
    firstStep = false;
  }
  return { x: cx, y: cy, landed: false, platform: -1, bonked: false, cornerShift };
}

/** The smallest sideways nudge (at most `cornerCorrectionU`) that clears a ceiling corner, or 0. */
function cornerNudge(
  world: CollisionWorld,
  x: number,
  fromY: number,
  toY: number,
  blockers: Extents,
  size: BodySize,
  ignore: number,
  preferDir: 1 | -1,
): number {
  const right = blockers.maxRight - (x - size.halfW);
  const left = x + size.halfW - blockers.minLeft;
  const candidates = [right, -left]
    .filter((s) => Math.abs(s) > 0 && Math.abs(s) <= P.cornerCorrectionU)
    .sort((a, b) => Math.abs(a) - Math.abs(b) || (Math.sign(b) === preferDir ? 1 : -1));
  for (const shift of candidates) {
    const nx = x + shift;
    const free = (feet: number): boolean =>
      !solidExtents(world, nx - size.halfW, feet - size.height, nx + size.halfW, feet, ignore).hit;
    if (free(toY) && free(fromY)) return shift;
  }
  return 0;
}

export interface Support {
  /** Something under the feet (static ground or a platform). */
  readonly any: boolean;
  /** Some supporting surface is solid (a drop-through needs every surface to be one-way). */
  readonly solid: boolean;
  readonly ice: boolean;
  /** The moving platform carrying the body, or -1. Static ground takes precedence. */
  readonly platform: number;
  /** Exact height of the surface (snap target). */
  readonly y: number;
}

const NO_SUPPORT: Support = { any: false, solid: false, ice: false, platform: -1, y: 0 };

/** What the body stands on, if anything. */
export function findSupport(
  world: CollisionWorld,
  x: number,
  feetY: number,
  ignoreOneWay: boolean,
  size: BodySize = PLAYER_SIZE,
): Support {
  const left = x - size.halfW;
  const right = x + size.halfW;
  let any = false;
  let solid = false;
  let ice = false;
  let surfaceY = feetY;
  const row = Math.round(feetY / TILE);
  if (Math.abs(feetY - row * TILE) <= TILE_SUPPORT_EPS) {
    const c0 = Math.floor(left / TILE);
    const c1 = Math.ceil(right / TILE) - 1;
    for (let col = c0; col <= c1; col += 1) {
      const flags = tileFlags(world.level, col, row);
      if ((flags & TileFlag.Solid) !== 0) {
        any = true;
        solid = true;
        if ((flags & TileFlag.Ice) !== 0) ice = true;
      } else if ((flags & TileFlag.OneWay) !== 0 && !ignoreOneWay) {
        any = true;
      }
    }
    if (any) surfaceY = row * TILE;
  }
  const staticGround = any;
  let platform = -1;
  world.platforms.forEach((p, i) => {
    const def = world.level.platforms[i];
    if (!def || (def.oneWay && ignoreOneWay)) return;
    if (Math.abs(feetY - p.y) > C.platformSupportU || !(left < p.x + def.w && right > p.x)) return;
    any = true;
    if (!def.oneWay) solid = true;
    if (!staticGround && platform === -1) {
      platform = i;
      surfaceY = p.y;
    }
  });
  if (!any) return NO_SUPPORT;
  return { any, solid, ice, platform, y: surfaceY };
}

/** Solid contact on each side within `probeU` (one-way surfaces are never walls). */
export function wallContact(
  world: CollisionWorld,
  x: number,
  feetY: number,
  probeU: number,
  size: BodySize = PLAYER_SIZE,
): { readonly left: boolean; readonly right: boolean } {
  const top = feetY - size.height;
  const l = x - size.halfW;
  const r = x + size.halfW;
  return {
    left: solidExtents(world, l - probeU, top, l, feetY, -1).hit,
    right: solidExtents(world, r, top, r + probeU, feetY, -1).hit,
  };
}
