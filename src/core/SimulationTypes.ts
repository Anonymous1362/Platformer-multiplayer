import type { EntityAllocatorState, EntityId } from './EntityIds';
import type { DifficultyId, PlanetId } from './Ids';
import type { RandomState } from './Random';

/**
 * Simulation state: plain, cloneable, hashable data (spec section 12.4). No engine objects, DOM nodes,
 * timers, or functions. World coordinates are non-negative with +y pointing down.
 */
export interface PlayerState {
  readonly id: EntityId;
  readonly slot: number;
  x: number;
  /** Feet position (collider origin is bottom-center). */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  /** Buttons held this tick and last tick; the simulation derives press/release edges from these. */
  held: number;
  prevHeld: number;
  /** Ticks since leaving the ground (0 while grounded). */
  airTicks: number;
}

/** Setup that fully determines a world's starting state. Pass 1C replaces the flat floor with levels. */
export interface WorldSetup {
  readonly seed: number;
  readonly planet: PlanetId;
  readonly difficulty: DifficultyId;
  readonly playerCount: number;
  /** Flat test floor (world units, +y down) until tile collision arrives in Pass 1C. */
  readonly floorY: number;
  readonly worldWidth: number;
  readonly spawnX: number;
}

export interface WorldState {
  tick: number;
  readonly setup: WorldSetup;
  rng: RandomState;
  readonly entities: EntityAllocatorState;
  readonly players: PlayerState[];
}

export type SimulationEvent =
  | { readonly type: 'jumped'; readonly playerId: EntityId; readonly tick: number }
  | { readonly type: 'landed'; readonly playerId: EntityId; readonly tick: number };

export interface SimulationStepResult {
  readonly events: readonly SimulationEvent[];
}
