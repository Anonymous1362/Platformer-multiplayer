import type { CollisionWorld } from './Collision';
import { allocateEntity, type EntityId } from './EntityIds';
import type { DifficultyId } from './Ids';
import type { Level } from './level/LevelTypes';
import type { Assists, SimulationEvent, WorldState } from './SimulationTypes';

/** Gravity scale and air control of the level's planet (spec 4.1). */
export interface PlanetPhysics {
  readonly gravity: number;
  readonly airDecelFactor: number;
}

/** What every simulation system receives for one tick. */
export interface SimContext {
  readonly state: WorldState;
  readonly level: Level;
  readonly world: CollisionWorld;
  readonly planet: PlanetPhysics;
  readonly difficulty: DifficultyId;
  readonly assists: Assists;
  readonly events: SimulationEvent[];
  readonly tick: number;
}

/** A new entity ID, or null when the allocator is full (callers skip the spawn; nothing crashes). */
export function newEntityId(state: WorldState): EntityId | null {
  return allocateEntity(state.entities);
}

/** Inserts keeping the list sorted by ascending entity ID (stable iteration order, spec 13.4). */
export function insertById<T extends { readonly id: EntityId }>(list: T[], item: T): void {
  let i = list.length;
  while (i > 0 && (list[i - 1]?.id ?? 0) > item.id) i -= 1;
  list.splice(i, 0, item);
}
