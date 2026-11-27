import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DT, GameConfig, Ticks } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import type { SimulationEvent } from '../../src/core/SimulationTypes';
import { Harness, input, makeLevel } from '../fixtures/levels';

const W = GameConfig.weapons.pulse_blaster;
const HEAT = GameConfig.combat.heat;
const TILE = GameConfig.world.tileSizeU;
const SHOOT = input({ held: Button.Shoot });

/** A long flat room (floor top y = 640) with optional objects. */
function room(objects: Record<string, unknown>[] = [], width = 40): ReturnType<typeof makeLevel> {
  const rows = [
    '#'.repeat(width),
    ...Array.from({ length: 9 }, () => `#${'.'.repeat(width - 2)}#`),
    '#'.repeat(width),
  ];
  return makeLevel(rows, { spawn: [2, 9], objects });
}

function shots(events: readonly SimulationEvent[]): Extract<SimulationEvent, { type: 'shotFired' }>[] {
  return events.filter((e): e is Extract<SimulationEvent, { type: 'shotFired' }> => e.type === 'shotFired');
}

describe('Pulse Blaster (spec 4.2, 4.7)', () => {
  it('fires every 200 ms (5 shots per second) while Shoot is held', () => {
    const h = new Harness(room());
    h.run(60, SHOOT);
    const fired = shots(h.events);
    expect(fired).toHaveLength(5);
    expect(fired.map((e) => e.tick)).toEqual([0, 12, 24, 36, 48]);
  });

  it('bolts fly at 750 u/s straight ahead by default', () => {
    const h = new Harness(room());
    h.step(SHOOT);
    const bolt = h.world.projectiles[0];
    if (!bolt) throw new Error('no bolt');
    expect(bolt.vx).toBe(W.speedUps);
    expect(bolt.vy).toBe(0);
    const x0 = bolt.x;
    h.step();
    expect(bolt.x - x0).toBeCloseTo(W.speedUps * DT, 9);
  });

  it('heat: +4 per shot, -12/s while firing, -40/s idle', () => {
    const h = new Harness(room());
    h.step(SHOOT);
    expect(h.player.heat).toBe(W.heatPerShot);
    h.step(SHOOT);
    expect(h.player.heat).toBeCloseTo(W.heatPerShot - HEAT.dissipateFiringPerS * DT, 9);
    const before = h.player.heat;
    h.step();
    expect(h.player.heat).toBeCloseTo(before - HEAT.dissipateIdlePerS * DT, 9);
  });

  it('at 100 heat it vents for 1.2 s and cannot fire, then works again', () => {
    const h = new Harness(room());
    h.player.heat = 99;
    h.step(SHOOT);
    expect(h.eventsOf('weaponVented')).toHaveLength(1);
    expect(h.player.heat).toBe(HEAT.max);
    const shotsBefore = shots(h.events).length;
    h.run(Ticks.vent, SHOOT);
    expect(shots(h.events)).toHaveLength(shotsBefore);
    expect(h.player.heat).toBe(0);
    h.step(SHOOT);
    expect(shots(h.events)).toHaveLength(shotsBefore + 1);
  });

  it('continuous fire overheats after about 12.5 s (net +8 heat per second)', () => {
    const h = new Harness(room());
    h.until((s) => s.eventsOf('weaponVented').length > 0, SHOOT, 1000);
    expect(h.world.tick / 60).toBeGreaterThan(11);
    expect(h.world.tick / 60).toBeLessThan(14);
  });

  it('bolts stop at walls and vanish after 1200 u', () => {
    const h = new Harness(room([], 12));
    h.step(SHOOT);
    h.until((s) => s.world.projectiles.length === 0, input());
    const hit = h.eventsOf('projectileHit')[0];
    expect(hit?.type === 'projectileHit' && hit.targetId).toBe(0);
    expect(hit?.type === 'projectileHit' && hit.x).toBeCloseTo(11 * TILE, 6);

    const open = new Harness(room([], 60));
    open.step(SHOOT);
    const ticks = open.until((s) => s.world.projectiles.length === 0, input(), 200);
    expect(ticks).toBe(Math.ceil(GameConfig.combat.projectile.maxRangeU / (W.speedUps * DT)) - 1);
    expect(open.eventsOf('projectileHit')).toHaveLength(0);
  });

  it('manual aim (AimManual + aimMrad) fires along the given angle', () => {
    const h = new Harness(room());
    h.step(input({ held: Button.Shoot | Button.AimManual, aimMrad: -1571 }));
    const bolt = h.world.projectiles[0];
    expect(bolt?.vx).toBeCloseTo(0, 0);
    expect(bolt?.vy).toBeCloseTo(-W.speedUps, 1);
  });
});

describe('auto aim (spec 4.2)', () => {
  const crawlerAt = (x: number, y: number): Record<string, unknown> => ({
    id: `c${String(x)}_${String(y)}`,
    type: 'enemy',
    archetype: 'crawler',
    x,
    y,
    patrol: [x - 1, x + 1],
  });

  function firstShot(objects: Record<string, unknown>[], rows?: string[]): { dirX: number; dirY: number } {
    const level = rows ? makeLevel(rows, { spawn: [2, rows.length - 2], objects }) : room(objects);
    const h = new Harness(level);
    for (const e of h.world.enemies) e.asleep = false;
    h.step(SHOOT);
    const shot = shots(h.events)[0];
    if (!shot) throw new Error('no shot');
    return shot;
  }

  it('targets the nearest enemy inside the 30° cone in line of sight', () => {
    const shot = firstShot([crawlerAt(9, 7)]); // ahead and a little up
    expect(shot.dirX).toBeGreaterThan(0.866);
    expect(shot.dirY).toBeLessThan(-0.01);
  });

  it('fires straight ahead when the enemy is outside the cone, out of range, or behind a wall', () => {
    expect(firstShot([crawlerAt(4, 1)])).toEqual(expect.objectContaining({ dirX: 1, dirY: 0 }));
    expect(firstShot([crawlerAt(20, 9)])).toEqual(expect.objectContaining({ dirX: 1, dirY: 0 })); // beyond 900 u
    const walled = [
      '##############',
      '#............#',
      '#............#',
      '#.....#......#',
      '#.....#......#',
      '#.....#......#',
      '##############',
    ];
    expect(firstShot([crawlerAt(9, 5)], walled)).toEqual(expect.objectContaining({ dirX: 1, dirY: 0 }));
  });
});

describe('no bolt passes through a wall (N3, property)', () => {
  it('random wall columns and aim angles', () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 14 }), fc.integer({ min: -700, max: 700 }), (wallCol, aim) => {
        const rows = Array.from({ length: 12 }, (_, r) => {
          if (r === 0 || r === 11) return '#'.repeat(20);
          return Array.from({ length: 20 }, (__, c) =>
            c === 0 || c === 19 || c === wallCol ? '#' : '.',
          ).join('');
        });
        const h = new Harness(makeLevel(rows, { spawn: [2, 10] }));
        h.step(input({ held: Button.Shoot | Button.AimManual, aimMrad: aim }));
        for (let i = 0; i < 120 && h.world.projectiles.length > 0; i += 1) {
          h.step();
          for (const b of h.world.projectiles) expect(b.x).toBeLessThan(wallCol * 64 + 1e-6);
        }
      }),
      { seed: 11, numRuns: 120 },
    );
  });
});
