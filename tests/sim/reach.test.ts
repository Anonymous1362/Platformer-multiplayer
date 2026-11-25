import { describe, expect, it } from 'vitest';
import type { PlanetId } from '../../src/core/Ids';
import { Button, type InputFrame } from '../../src/core/InputTypes';
import { createWorld, WorldSimulation } from '../../src/core/WorldSimulation';

/** Derived reach from spec section 4.1 (full jump held at max run speed; tests pin within ±2 u). */
const EXPECTED: Readonly<Record<PlanetId, { apexU: number; flatDistanceU: number }>> = {
  kepler: { apexU: 201, flatDistanceU: 392 },
  vulcanis: { apexU: 199, flatDistanceU: 294 },
  cryos: { apexU: 200, flatDistanceU: 308 },
  aether: { apexU: 201, flatDistanceU: 343 },
  obsidian: { apexU: 199, flatDistanceU: 301 },
};

const RUN: InputFrame = { moveX: 1, moveY: 0, held: 0, aimMrad: 0 };
const RUN_AND_JUMP: InputFrame = { moveX: 1, moveY: 0, held: Button.Jump, aimMrad: 0 };

describe('derived reach (spec section 4.1)', () => {
  for (const [planet, expected] of Object.entries(EXPECTED) as [PlanetId, (typeof EXPECTED)[PlanetId]][]) {
    it(`${planet}: full jump apex ${String(expected.apexU)} u, flat distance ${String(expected.flatDistanceU)} u`, () => {
      const floorY = 1000;
      const world = createWorld({
        seed: 7,
        planet,
        difficulty: 'normal',
        playerCount: 1,
        floorY,
        worldWidth: 8000,
        spawnX: 100,
      });
      const sim = new WorldSimulation({ assertFinite: true });
      const player = world.players[0];
      if (!player) throw new Error('no player');

      let tick = 0;
      for (; tick < 30; tick += 1) sim.step(world, [RUN], tick); // reach max run speed
      expect(player.vx).toBe(420);

      const takeoffX = player.x;
      let minY = player.y;
      let landed = false;
      for (; tick < 400 && !landed; tick += 1) {
        const { events } = sim.step(world, [RUN_AND_JUMP], tick);
        minY = Math.min(minY, player.y);
        landed = events.some((e) => e.type === 'landed');
      }
      expect(landed).toBe(true);
      expect(Math.abs(floorY - minY - expected.apexU)).toBeLessThanOrEqual(2);
      expect(Math.abs(player.x - takeoffX - expected.flatDistanceU)).toBeLessThanOrEqual(2);
    });
  }

  it('jump height is the same on every planet within 3 u (jump velocity scales with sqrt(gravity))', () => {
    const apexes = Object.values(EXPECTED).map((e) => e.apexU);
    expect(Math.max(...apexes) - Math.min(...apexes)).toBeLessThanOrEqual(3);
  });
});
