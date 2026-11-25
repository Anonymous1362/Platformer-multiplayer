import { describe, expect, it } from 'vitest';
import { overlapsSolid } from '../../src/core/Collision';
import { DT, GameConfig, msToTicks } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import { Harness, input, makeLevel } from '../fixtures/levels';

const P = GameConfig.player;
/** 20 × 11 room, floor top y = 640. */
const ROOM = [
  '####################',
  ...Array.from({ length: 9 }, () => '#..................#'),
  '####################',
];

function platformLevel(platform: Record<string, unknown>) {
  return makeLevel(ROOM, { spawn: [1, 9], objects: [{ id: 'mp', type: 'moving_platform', ...platform }] });
}

const SHUTTLE = platformLevel({
  x: 3,
  y: 7,
  path: [
    [3, 7],
    [10, 7],
  ],
  speedUps: 120,
  waitMs: 300,
  oneWay: true,
  w: 3,
  h: 0.5,
});

describe('moving platforms (spec 4.1, 13.5)', () => {
  it('ping-pongs along its path and waits at each end', () => {
    const h = new Harness(SHUTTLE);
    const p = h.world.platforms[0];
    if (!p) throw new Error('no platform');
    const ticksToEnd = h.until((s) => s.world.platforms[0]?.x === 10 * 64, input());
    expect(Math.abs(ticksToEnd - (7 * 64) / (120 * DT))).toBeLessThanOrEqual(1);
    expect(p.waitTicks).toBe(msToTicks(300));
    h.run(18);
    expect(p.x).toBe(10 * 64);
    h.step();
    expect(p.x).toBeLessThan(10 * 64);
    h.until((s) => s.world.platforms[0]?.x === 3 * 64, input(), 400);
    expect(p.y).toBe(7 * 64);
  });

  it('carries a rider, who keeps its place on the platform', () => {
    const h = new Harness(SHUTTLE);
    const p = h.world.platforms[0];
    if (!p) throw new Error('no platform');
    h.placePlayer(3 * 64 + 96, 7 * 64);
    h.step();
    expect(h.player.grounded).toBe(true);
    expect(h.player.groundPlatform).toBe(0);
    const offset = h.player.x - p.x;
    h.run(100);
    expect(h.player.x - p.x).toBeCloseTo(offset, 6);
    expect(h.player.y).toBe(p.y);
  });

  it('jumping off inherits the platform velocity', () => {
    const h = new Harness(SHUTTLE);
    h.placePlayer(3 * 64 + 96, 7 * 64);
    h.run(10);
    const vx = 120;
    h.step(input({ held: Button.Jump }));
    // Inherited 120 u/s, then one tick of air deceleration toward the neutral stick.
    expect(h.player.vx).toBeCloseTo(vx - P.airDecelUps2 * DT, 6);
  });

  it('inherited velocity is capped at 300 u/s', () => {
    const fast = platformLevel({
      x: 2,
      y: 7,
      path: [
        [2, 7],
        [15, 7],
      ],
      speedUps: 500,
      waitMs: 0,
      oneWay: true,
      w: 3,
      h: 0.5,
    });
    const h = new Harness(fast);
    h.placePlayer(2 * 64 + 96, 7 * 64);
    h.run(5);
    expect(h.player.groundPlatform).toBe(0);
    h.step(input({ held: Button.Jump }));
    expect(h.player.vx).toBeCloseTo(P.platformInheritCapUps - P.airDecelUps2 * DT, 6);
  });

  it('a rising elevator lifts its rider, and the jump inherits the lift', () => {
    const lift = platformLevel({
      x: 8,
      y: 9.5,
      path: [
        [8, 9.5],
        [8, 4],
      ],
      speedUps: 150,
      waitMs: 0,
      oneWay: false,
      w: 3,
      h: 0.5,
    });
    const h = new Harness(lift);
    h.placePlayer(8 * 64 + 96, 9.5 * 64);
    h.step();
    expect(h.player.groundPlatform).toBe(0);
    h.run(30);
    const p = h.world.platforms[0];
    expect(h.player.y).toBe(p?.y);
    expect(h.player.y).toBeLessThan(9.5 * 64 - 60);
    h.step(input({ held: Button.Jump }));
    expect(h.player.vy).toBeCloseTo(-P.jumpVelocityUps - 150 + P.gravityRiseUps2 * DT, 6);
  });

  it('a platform pressing a player into the floor crushes: hazard respawn, never stuck', () => {
    const press = platformLevel({
      x: 5,
      y: 5,
      path: [
        [5, 5],
        [5, 9],
      ],
      speedUps: 200,
      waitMs: 0,
      oneWay: false,
      w: 3,
      h: 0.5,
    });
    const h = new Harness(press);
    h.standAt(5 * 64 + 96, 640);
    h.until((s) => s.player.mode === 'hazardRespawn', input(), 200);
    const hit = h.eventsOf('hazardHit')[0];
    expect(hit?.type === 'hazardHit' && hit.cause).toBe('crush');
    h.until((s) => s.player.mode !== 'hazardRespawn', input());
    expect(overlapsSolid({ level: h.level, platforms: h.world.platforms }, h.player.x, h.player.y)).toBe(
      false,
    );
  });

  it('a platform shoving a player into a wall crushes; an open path just pushes', () => {
    const sweep = platformLevel({
      x: 6,
      y: 8,
      path: [
        [6, 8],
        [1, 8],
      ],
      speedUps: 240,
      waitMs: 0,
      oneWay: false,
      w: 2,
      h: 2,
    });
    const h = new Harness(sweep);
    h.standAt(4 * 64, 640);
    h.run(40);
    expect(h.player.mode).toBe('ground');
    expect(h.player.x).toBeLessThan(4 * 64 - 40); // pushed along the floor, not stuck
    expect(overlapsSolid({ level: h.level, platforms: h.world.platforms }, h.player.x, h.player.y)).toBe(
      false,
    );
    h.until((s) => s.player.mode === 'hazardRespawn', input(), 200);
    const hit = h.eventsOf('hazardHit')[0];
    expect(hit?.type === 'hazardHit' && hit.cause).toBe('crush');
  });

  it('one-way platforms catch from above and let jumps through from below', () => {
    const h = new Harness(SHUTTLE);
    h.standAt(4 * 64 + 32, 640);
    h.step(input({ held: Button.Jump }));
    const landed = h.until(
      (s) => s.player.grounded,
      (s) => input({ held: s.player.vy < 0 ? Button.Jump : 0 }),
    );
    expect(landed).toBeGreaterThan(5);
    expect(h.player.groundPlatform).toBe(0);
    expect(h.eventsOf('hazardHit')).toHaveLength(0);
  });
});
