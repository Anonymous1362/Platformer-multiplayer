import { describe, expect, it } from 'vitest';
import type { DifficultyId } from '../../src/core/Ids';
import { loadLevelById } from '../../tools/shared/levels';
import { arenaAutopilot } from '../fixtures/autopilot';
import { Harness } from '../fixtures/levels';

/**
 * Pass 1E acceptance, "the arena plays start to finish": the closed-loop autopilot
 * (tests/fixtures/autopilot.ts) plays `test_arena` with ordinary inputs and must reach the exit.
 */

function runArena(difficulty: DifficultyId): { h: Harness; ticks: number } {
  const level = loadLevelById('test_arena');
  const h = new Harness(level, 1, 1, difficulty);
  const pilot = arenaAutopilot(level);
  const ticks = h.until(
    (s) => s.world.run.completeTick >= 0,
    (s) => pilot(s.world, 0),
    60 * 120,
  );
  return { h, ticks };
}

describe('test arena, start to finish (Pass 1E acceptance)', () => {
  it('an autopilot reaches the exit on Normal: both checkpoints, Crawlers cleared, shards banked', () => {
    const { h, ticks } = runArena('normal');
    expect(h.eventsOf('levelComplete')).toHaveLength(1);
    expect(h.world.run.checkpointsReached).toEqual([1, 1]);
    expect(h.eventsOf('enemyDefeated').length).toBeGreaterThanOrEqual(2);
    expect(h.world.run.shardsBanked).toBeGreaterThan(0);
    expect(ticks).toBeLessThan(60 * 120);
    // A clean run: no deaths, at most a couple of hazard touches.
    expect(h.eventsOf('died')).toHaveLength(0);
    console.info(
      `arena run: ${String(ticks)} ticks (${(ticks / 60).toFixed(1)} s), shards ${String(h.world.run.shardsBanked)}, ` +
        `Crawlers ${String(h.eventsOf('enemyDefeated').length)}, hazard hits ${String(h.eventsOf('hazardHit').length)}`,
    );
  });

  it('also finishes on Hard (more Crawler HP and damage, shorter telegraphs)', () => {
    const { h } = runArena('hard');
    expect(h.eventsOf('levelComplete')).toHaveLength(1);
  });

  it('the same run is identical when repeated (deterministic)', () => {
    const a = runArena('normal');
    const b = runArena('normal');
    expect(b.ticks).toBe(a.ticks);
    expect(b.h.world.run).toEqual(a.h.world.run);
  });
});
