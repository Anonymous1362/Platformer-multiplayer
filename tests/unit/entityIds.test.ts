import { describe, expect, it } from 'vitest';
import { EntityIdPool } from '../../src/core/EntityIds';

describe('EntityIdPool', () => {
  it('invalidates a released reference and increments its generation on reuse', () => {
    const pool = new EntityIdPool();
    const first = pool.allocate();

    expect(pool.isCurrent(first)).toBe(true);
    expect(pool.release(first)).toBe(true);
    expect(pool.isCurrent(first)).toBe(false);

    const reused = pool.allocate();
    expect(reused.id).toBe(first.id);
    expect(reused.generation).toBe(first.generation + 1);
    expect(pool.isCurrent(reused)).toBe(true);
    expect(pool.activeCount()).toBe(1);
  });

  it('rejects stale and malformed references without changing current entities', () => {
    const pool = new EntityIdPool();
    const current = pool.allocate();
    expect(pool.release({ id: current.id, generation: current.generation + 1 })).toBe(false);
    expect(pool.release({ id: Number.NaN, generation: current.generation })).toBe(false);
    expect(pool.isCurrent(current)).toBe(true);
  });

  it('round-trips a validated pool snapshot', () => {
    const original = new EntityIdPool();
    const reference = original.allocate();
    const restored = new EntityIdPool(original.snapshot());

    expect(restored.isCurrent(reference)).toBe(true);
    expect(restored.allocate()).toEqual({ id: 1, generation: 1 });
  });
});
