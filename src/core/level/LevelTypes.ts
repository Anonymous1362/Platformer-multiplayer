import type { PlanetId } from '../Ids';

/**
 * Parsed, immutable level data (spec sections 5.2 and 13.5). Produced only by `parseLevel`, which
 * validates untrusted JSON. World units: 64 u per tile, origin at the top-left, +y down.
 */

/** Per-tile collision flags (spec section 13.5). */
export const TileFlag = {
  Solid: 1 << 0,
  OneWay: 1 << 1,
  Spikes: 1 << 2,
  Lava: 1 << 3,
  Ice: 1 << 4,
} as const;

export const HAZARD_FLAGS = TileFlag.Spikes | TileFlag.Lava;

/**
 * Tile legend (spec section 5.2) for the characters the simulation implements so far. Crumbling (`x`)
 * and cracked (`c`) tiles are rejected by the parser until their behavior exists (Pass 3), so no level
 * can silently depend on a missing mechanic.
 */
export const TILE_LEGEND: Readonly<Record<string, number>> = {
  '.': 0,
  '#': TileFlag.Solid,
  '=': TileFlag.OneWay,
  '^': TileFlag.Spikes,
  '~': TileFlag.Lava,
  '%': TileFlag.Solid | TileFlag.Ice,
};

export const ZONE_TYPES = ['camera_bounds', 'section', 'kill_plane', 'no_safe_ground'] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

/** Axis-aligned rectangle in world units (left, top, width, height). */
export interface RectU {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface LevelZone extends RectU {
  readonly id: string;
  readonly type: ZoneType;
}

/** A kinematic platform (spec section 5.2 `moving_platform`). Path points are top-left corners. */
export interface PlatformDef {
  readonly id: string;
  readonly path: readonly { readonly x: number; readonly y: number }[];
  readonly w: number;
  readonly h: number;
  readonly speedUps: number;
  readonly waitTicks: number;
  readonly oneWay: boolean;
}

export const ENEMY_ARCHETYPES = ['crawler'] as const;
export type EnemyArchetype = (typeof ENEMY_ARCHETYPES)[number];

/** Enemy spawn: feet position, facing, and optional patrol bounds for its center x (world units). */
export interface EnemySpawn {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly x: number;
  readonly y: number;
  readonly facing: 1 | -1;
  readonly patrol: { readonly minX: number; readonly maxX: number } | null;
}

/** A point object: checkpoints and exits are bottom-anchored (feet); shards are centered. */
export interface LevelPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface Level {
  readonly id: string;
  readonly planet: PlanetId;
  readonly nameKey: string;
  readonly musicId: string;
  readonly parTimeSec: number | null;
  readonly widthTiles: number;
  readonly heightTiles: number;
  /** The ASCII rows, kept for renderers and tools. */
  readonly rows: readonly string[];
  /** Row-major tile flags, `widthTiles * heightTiles` entries. */
  readonly tiles: Uint8Array;
  /** Player spawn, feet position in world units. */
  readonly spawn: { readonly x: number; readonly y: number };
  readonly platforms: readonly PlatformDef[];
  readonly enemies: readonly EnemySpawn[];
  /** Every shard in the level (shard lines expanded), centers in world units. */
  readonly shards: readonly LevelPoint[];
  readonly checkpoints: readonly LevelPoint[];
  readonly exits: readonly LevelPoint[];
  readonly zones: readonly LevelZone[];
  /** FNV-1a over the canonical JSON of the validated source; goes into replays. */
  readonly hash: string;
}

/** Hard limits (spec section 5.6): the network encodes positions as Uint16 half-units. */
export const LEVEL_LIMITS = {
  maxWidthTiles: 400,
  maxHeightTiles: 200,
  maxPlatforms: 64,
  maxZones: 256,
  maxEnemies: 256,
  maxShards: 1024,
  maxCheckpoints: 64,
} as const;
