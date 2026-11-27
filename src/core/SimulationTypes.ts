import type { EntityAllocatorState, EntityId } from './EntityIds';
import type { DifficultyId } from './Ids';
import type { EnemyArchetype } from './level/LevelTypes';
import type { RandomState } from './Random';

/**
 * Simulation state: plain, cloneable, hashable data (spec section 12.4). No engine objects, DOM nodes,
 * timers, or functions. World coordinates are non-negative with +y pointing down. Static level geometry
 * is not part of the state: it lives in the immutable `Level` the simulation is built with.
 */

/**
 * Player state machine (spec section 4.1). `ground`, `air`, and `wallSlide` follow from contact each
 * tick; `dash`, `hazardRespawn`, and `dead` are timed states that ignore normal control.
 */
export const PLAYER_MODES = ['ground', 'air', 'wallSlide', 'dash', 'hazardRespawn', 'dead'] as const;
export type PlayerMode = (typeof PLAYER_MODES)[number];

export interface PlayerState {
  readonly id: EntityId;
  readonly slot: number;
  x: number;
  /** Feet position (collider origin is bottom-center). */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  mode: PlayerMode;
  /** Ticks spent in the current timed mode (dash, hazardRespawn, dead). */
  modeTicks: number;
  grounded: boolean;
  /** Index of the moving platform the player stands on, or -1. */
  groundPlatform: number;
  /** Buttons held this tick and last tick; the simulation derives press/release edges from these. */
  held: number;
  prevHeld: number;
  /** Ticks since leaving the ground (0 while grounded). */
  airTicks: number;
  /** A coyote jump is still possible (left the ground without jumping or dropping through). */
  coyoteAvailable: boolean;
  /** Ticks left in the jump buffer (spec 4.1: 130 ms). */
  jumpBufferTicks: number;
  /** Ticks since the last jump or wall jump took off. */
  jumpTicks: number;
  /** The variable-jump cut has not been used for the current jump yet. */
  jumpCutAvailable: boolean;
  /** Horizontal input is ignored while this counts down (wall jump, knockback). */
  controlLockTicks: number;
  /** Wall being slid on: -1 left, 1 right, 0 none (for rendering and dash direction). */
  wallSide: -1 | 0 | 1;
  /** Jetpack fuel in seconds of burn. */
  fuelS: number;
  jetpacking: boolean;
  dashDir: 1 | -1;
  dashCooldownTicks: number;
  airDashUsed: boolean;
  iframeTicks: number;
  /** Ticks left in which one-way platforms are ignored after a drop-through. */
  dropGraceTicks: number;
  hp: number;
  shield: number;
  invulnTicks: number;
  ticksSinceHit: number;
  /** Pulse Blaster (spec 4.2, 4.7): ticks until the next shot, heat 0–100, ticks left venting. */
  fireCooldownTicks: number;
  heat: number;
  ventTicks: number;
  /** Committed safe ground (feet position), at least 1 s old (spec section 4.3). */
  safeX: number;
  safeY: number;
  /** The newest safe-ground sample and the tick it was taken; becomes `safe*` once old enough. */
  pendingSafeX: number;
  pendingSafeY: number;
  pendingSafeTick: number;
}

/** Runtime state of a moving platform; its size and path live in the level's `PlatformDef`. */
export interface PlatformState {
  /** Top-left corner. */
  x: number;
  y: number;
  /** Position at the start of the current tick (one-way crossing tests and rider velocity). */
  prevX: number;
  prevY: number;
  /** Index of the path point it is moving toward. */
  target: number;
  /** Direction along the path: +1 forward, -1 back (ping-pong). */
  dir: 1 | -1;
  waitTicks: number;
}

/** Shared enemy state machine (spec section 4.4). */
export const ENEMY_MODES = [
  'idle',
  'patrol',
  'alert',
  'engage',
  'windup',
  'attack',
  'recover',
  'stunned',
  'dead',
] as const;
export type EnemyMode = (typeof ENEMY_MODES)[number];

export interface EnemyState {
  readonly id: EntityId;
  readonly archetype: EnemyArchetype;
  /** Index into `level.enemies`, for resets. */
  readonly spawnIndex: number;
  x: number;
  /** Feet position (bottom-center), like players. */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  readonly maxHp: number;
  mode: EnemyMode;
  modeTicks: number;
  grounded: boolean;
  /** Far from every player: frozen, keeping its state (spec 4.4). */
  asleep: boolean;
  /** Slot of the player being engaged, or -1. */
  targetSlot: number;
  /** Ticks the target has been out of engage range. */
  lostTicks: number;
  /** Distance covered by the current charge. */
  chargeU: number;
}

export interface ProjectileState {
  readonly id: EntityId;
  /** The entity that fired it (a player or an enemy). */
  readonly ownerId: EntityId;
  readonly team: 'player' | 'enemy';
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly damage: number;
  rangeLeftU: number;
}

export interface PickupState {
  readonly id: EntityId;
  /** Index into `level.shards`, or -1 for an enemy drop. */
  readonly source: number;
  x: number;
  /** Center position. */
  y: number;
  vx: number;
  vy: number;
  /** No gravity: level shards hover, landed drops rest, magnetized shards fly to a player. */
  floating: boolean;
}

/** Shard status per level shard (spec 3.5). */
export const ShardStatus = { Present: 0, Banked: 1, Carried: 2 } as const;

/** Campaign progress within one level run (spec sections 3.5 and 4.3). */
export interface RunState {
  shardsBanked: number;
  /** Collected since the last checkpoint; lost on death. */
  shardsCarried: number;
  /** One entry per level shard: {@link ShardStatus}. */
  readonly shardStatus: number[];
  /** One entry per checkpoint: 1 once reached. */
  readonly checkpointsReached: number[];
  /** Index of the active checkpoint, or -1 for the level spawn. */
  checkpoint: number;
  respawnX: number;
  respawnY: number;
  /** Tick the exit was reached, or -1. */
  completeTick: number;
}

/** Everything that, with a level, fully determines a world's starting state. */
export interface WorldSetup {
  readonly seed: number;
  readonly difficulty: DifficultyId;
  readonly playerCount: number;
  readonly levelId: string;
  /** `Level.hash` of the level the run was made on; mismatches are refused. */
  readonly levelHash: string;
}

export interface WorldState {
  tick: number;
  readonly setup: WorldSetup;
  rng: RandomState;
  readonly entities: EntityAllocatorState;
  readonly players: PlayerState[];
  readonly platforms: PlatformState[];
  /** Kept sorted by ascending entity ID (stable iteration, spec 13.4). */
  readonly enemies: EnemyState[];
  readonly projectiles: ProjectileState[];
  readonly pickups: PickupState[];
  readonly run: RunState;
}

export type HazardCause = 'spikes' | 'lava' | 'pit' | 'crush';
export type DamageSource = 'enemy' | 'hazard';

export type SimulationEvent =
  | { readonly type: 'jumped'; readonly playerId: EntityId; readonly tick: number }
  | { readonly type: 'wallJumped'; readonly playerId: EntityId; readonly tick: number }
  | { readonly type: 'landed'; readonly playerId: EntityId; readonly tick: number }
  | { readonly type: 'droppedThrough'; readonly playerId: EntityId; readonly tick: number }
  | { readonly type: 'dashed'; readonly playerId: EntityId; readonly tick: number }
  | {
      readonly type: 'hazardHit';
      readonly playerId: EntityId;
      readonly tick: number;
      readonly cause: HazardCause;
      readonly damage: number;
    }
  | {
      readonly type: 'respawned';
      readonly playerId: EntityId;
      readonly tick: number;
      /** True after a death (back at the checkpoint), false after a hazard fade. */
      readonly fromDeath: boolean;
    }
  | { readonly type: 'died'; readonly playerId: EntityId; readonly tick: number }
  | {
      readonly type: 'playerHurt';
      readonly playerId: EntityId;
      readonly tick: number;
      readonly damage: number;
      readonly sourceX: number;
    }
  | {
      readonly type: 'shotFired';
      readonly playerId: EntityId;
      readonly tick: number;
      readonly x: number;
      readonly y: number;
      readonly dirX: number;
      readonly dirY: number;
    }
  | { readonly type: 'weaponVented'; readonly playerId: EntityId; readonly tick: number }
  | {
      readonly type: 'projectileHit';
      readonly tick: number;
      readonly x: number;
      readonly y: number;
      /** The entity hit, or 0 for a wall. */
      readonly targetId: EntityId;
    }
  | {
      readonly type: 'enemyHurt';
      readonly enemyId: EntityId;
      readonly tick: number;
      readonly damage: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'enemyAlert'; readonly enemyId: EntityId; readonly tick: number }
  | { readonly type: 'enemyWindup'; readonly enemyId: EntityId; readonly tick: number }
  | {
      readonly type: 'enemyDefeated';
      readonly enemyId: EntityId;
      readonly tick: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: 'shardCollected';
      readonly playerId: EntityId;
      readonly tick: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: 'checkpointReached';
      readonly playerId: EntityId;
      readonly tick: number;
      readonly index: number;
    }
  | { readonly type: 'levelComplete'; readonly playerId: EntityId; readonly tick: number };

export interface SimulationStepResult {
  readonly events: readonly SimulationEvent[];
}
