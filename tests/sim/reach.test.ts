import { describe, expect, it } from 'vitest';
import { DT, GameConfig } from '../../src/core/GameConfig';
import { PLANET_IDS, type PlanetId } from '../../src/core/Ids';
import { Button } from '../../src/core/InputTypes';
import { flatLevel, Harness, input } from '../fixtures/levels';

/** Derived reach from spec section 4.1 (tests pin these within ±2 u). */
const EXPECTED: Readonly<
  Record<PlanetId, { apexU: number; flatDistanceU: number; jetApexU: number; jetDistanceU: number }>
> = {
  kepler: { apexU: 201, flatDistanceU: 392, jetApexU: 343, jetDistanceU: 910 },
  vulcanis: { apexU: 199, flatDistanceU: 294, jetApexU: 337, jetDistanceU: 777 },
  cryos: { apexU: 200, flatDistanceU: 308, jetApexU: 338, jetDistanceU: 798 },
  aether: { apexU: 201, flatDistanceU: 343, jetApexU: 341, jetDistanceU: 847 },
  obsidian: { apexU: 199, flatDistanceU: 301, jetApexU: 339, jetDistanceU: 784 },
};

const RUN = input({ moveX: 1 });
const RUN_AND_JUMP = input({ moveX: 1, held: Button.Jump });

/** Runs to max speed, then jumps; `hold` decides each tick whether Jump stays held. */
function measureJump(planet: PlanetId, hold: (h: Harness) => boolean) {
  const h = new Harness(flatLevel(planet));
  const p = h.player;
  const floorY = p.y;
  h.run(30, RUN);
  expect(p.vx).toBe(GameConfig.player.maxRunSpeedUps);
  const takeoffX = p.x;
  let minY = p.y;
  h.step(RUN_AND_JUMP);
  expect(h.eventsOf('jumped')).toHaveLength(1);
  h.until(
    (s) => {
      minY = Math.min(minY, s.player.y);
      return s.player.grounded;
    },
    (s) => (hold(s) ? RUN_AND_JUMP : RUN),
  );
  return { apexU: floorY - minY, distanceU: p.x - takeoffX };
}

describe('derived reach (spec section 4.1)', () => {
  for (const planet of PLANET_IDS) {
    const expected = EXPECTED[planet];
    it(`${planet}: full jump apex ${String(expected.apexU)} u, flat distance ${String(expected.flatDistanceU)} u`, () => {
      // Jump held until the apex, then released so the jetpack does not start.
      const r = measureJump(planet, (h) => h.player.vy < 0);
      expect(Math.abs(r.apexU - expected.apexU)).toBeLessThanOrEqual(2);
      expect(Math.abs(r.distanceU - expected.flatDistanceU)).toBeLessThanOrEqual(2);
    });

    it(`${planet}: base jetpack apex ${String(expected.jetApexU)} u, distance ${String(expected.jetDistanceU)} u`, () => {
      // Jump held the whole way: the jetpack takes over at the apex and burns its full 1.00 s.
      const r = measureJump(planet, () => true);
      expect(Math.abs(r.apexU - expected.jetApexU)).toBeLessThanOrEqual(2);
      expect(Math.abs(r.distanceU - expected.jetDistanceU)).toBeLessThanOrEqual(2);
    });

    it(`${planet}: a tap jump still clears one tile (64 u)`, () => {
      const h = new Harness(flatLevel(planet));
      const floorY = h.player.y;
      h.step(input({ held: Button.Jump }));
      let minY = floorY;
      h.until((s) => {
        minY = Math.min(minY, s.player.y);
        return s.player.grounded;
      }, input());
      expect(floorY - minY).toBeGreaterThan(GameConfig.world.tileSizeU);
    });
  }

  it('a tap jump peaks at 77 u at 1.0x gravity', () => {
    const h = new Harness(flatLevel('obsidian'));
    const floorY = h.player.y;
    h.step(input({ held: Button.Jump }));
    let minY = floorY;
    h.until((s) => {
      minY = Math.min(minY, s.player.y);
      return s.player.grounded;
    }, input());
    expect(Math.abs(floorY - minY - 77)).toBeLessThanOrEqual(2);
  });

  it('jump height is the same on every planet within 3 u (jump velocity scales with sqrt(gravity))', () => {
    const apexes = Object.values(EXPECTED).map((e) => e.apexU);
    expect(Math.max(...apexes) - Math.min(...apexes)).toBeLessThanOrEqual(3);
  });

  it('the dash covers 10 ticks at 1100 u/s (183 u) and exits at max run speed', () => {
    const h = new Harness(flatLevel('obsidian'));
    const startX = h.player.x;
    h.step(input({ held: Button.Dash }));
    h.run(9);
    expect(h.player.x - startX).toBeCloseTo(10 * GameConfig.player.dash.speedUps * DT, 9);
    expect(h.player.mode).toBe('ground');
    expect(h.player.vx).toBe(GameConfig.player.maxRunSpeedUps);
  });
});
