/**
 * Entity IDs with generation counters (N4). An ID packs `generation * 65536 + index`, so a stale ID
 * held by a packet, timer, or callback stops matching once its slot is reused.
 * The allocator is plain data so it can live in `WorldState`, be cloned, and be hashed.
 */
export type EntityId = number;

/** Never a valid entity (generation 0). */
export const NO_ENTITY: EntityId = 0;

const INDEX_SPAN = 65536;
const MAX_GENERATION = 65535;

export interface EntityAllocatorState {
  readonly capacity: number;
  readonly generations: number[];
  readonly alive: boolean[];
  /** Free slot indexes, reused oldest-first so a freed ID stays stale as long as possible. */
  readonly freeList: number[];
}

export function createAllocator(capacity: number): EntityAllocatorState {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > INDEX_SPAN) {
    throw new RangeError(`capacity must be an integer in 1..${String(INDEX_SPAN)}`);
  }
  return {
    capacity,
    generations: new Array<number>(capacity).fill(0),
    alive: new Array<boolean>(capacity).fill(false),
    freeList: Array.from({ length: capacity }, (_, i) => i),
  };
}

export function entityIndex(id: EntityId): number {
  return id % INDEX_SPAN;
}

export function entityGeneration(id: EntityId): number {
  return Math.floor(id / INDEX_SPAN);
}

/** Returns a new ID, or null when every slot is in use. */
export function allocateEntity(state: EntityAllocatorState): EntityId | null {
  const index = state.freeList.shift();
  if (index === undefined) return null;
  const previous = state.generations[index] ?? 0;
  const generation = previous >= MAX_GENERATION ? 1 : previous + 1;
  state.generations[index] = generation;
  state.alive[index] = true;
  return generation * INDEX_SPAN + index;
}

export function isEntityAlive(state: EntityAllocatorState, id: EntityId): boolean {
  if (!Number.isInteger(id) || id <= 0) return false;
  const index = entityIndex(id);
  const generation = entityGeneration(id);
  return (
    index < state.capacity &&
    generation >= 1 &&
    state.alive[index] === true &&
    state.generations[index] === generation
  );
}

/** Frees a live ID. Returns false (and changes nothing) for stale or invalid IDs. */
export function freeEntity(state: EntityAllocatorState, id: EntityId): boolean {
  if (!isEntityAlive(state, id)) return false;
  const index = entityIndex(id);
  state.alive[index] = false;
  state.freeList.push(index);
  return true;
}
