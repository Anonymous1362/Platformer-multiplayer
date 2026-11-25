import type { EntityAllocatorState, EntityId } from './EntityIds';
import type { DifficultyId } from './Ids';
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
  wallJumpLockTicks: number;
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
}

export type HazardCause = 'spikes' | 'lava' | 'pit' | 'crush';

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
  | { readonly type: 'respawned'; readonly playerId: EntityId; readonly tick: number }
  | { readonly type: 'died'; readonly playerId: EntityId; readonly tick: number };

export interface SimulationStepResult {
  readonly events: readonly SimulationEvent[];
}
