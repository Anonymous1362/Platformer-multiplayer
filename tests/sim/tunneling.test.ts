import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { moveX, moveY, overlapsSolid, PLAYER_SIZE, type CollisionWorld } from '../../src/core/Collision';
import { GameConfig } from '../../src/core/GameConfig';
import { Button, type InputFrame } from '../../src/core/InputTypes';
import { createWorld, setupFor, WorldSimulation } from '../../src/core/WorldSimulation';
import { loadLevelById } from '../../tools/shared/levels';
import { makeLevel } from '../fixtures/levels';

/**
 * Property tests (spec 1C acceptance): no speed tunnels through a tile, and simulated players never
 * end a tick inside solid geometry, on random maps with random inputs.
 */

const TILE = GameConfig.world.tileSizeU;
const W = 14;
const H = 11;
const SEED = 20251125;

/** Random map: solid border, interior cells drawn from `.`, `#`, `=`, `^`; spawn column kept clear. */
const mapArb = fc
  .array(fc.constantFrom('.', '.', '.', '.', '#', '#', '=', '^'), {
    minLength: (W - 2) * (H - 2),
    maxLength: (W - 2) * (H - 2),
  })
  .map((cells) => {
    const rows: string[] = ['#'.repeat(W)];
    for (let r = 0; r < H - 2; r += 1) {
      let row = '#';
      for (let c = 0; c < W - 2; c += 1) {
        const spawnColumn = c === 0 && r >= H - 5;
        row += spawnColumn ? '.' : (cells[r * (W - 2) + c] ?? '.');
      }
      rows.push(`${row}#`);
    }
    rows.push('#'.repeat(W));
    return rows;
  });

function worldFor(rows: readonly string[]): CollisionWorld {
  return { level: makeLevel(rows, { spawn: [1, H - 2] }), platforms: [] };
}

/** True when the solid region swept by the box between two positions is free of solids. */
function sweptFree(world: CollisionWorld, x0: number, y0: number, x1: number, y1: number): boolean {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  // Sample the swept region with player-sized boxes 8 u apart (far less than a tile), never past the ends.
  for (let i = 0; minX + i * 8 < maxX + 8; i += 1) {
    const x = Math.min(minX + i * 8, maxX);
    for (let j = 0; minY + j * 8 < maxY + 8; j += 1) {
      if (overlapsSolid(world, x, Math.min(minY + j * 8, maxY))) return false;
    }
  }
  return !overlapsSolid(world, x1, y1);
}

const posArb = fc.record({
  x: fc.double({ min: TILE + PLAYER_SIZE.halfW, max: (W - 1) * TILE - PLAYER_SIZE.halfW, noNaN: true }),
  y: fc.double({ min: TILE + PLAYER_SIZE.height, max: (H - 1) * TILE, noNaN: true }),
});

describe('no tunneling (N3)', () => {
  it('moveX never passes through a solid tile at any speed (sub-steps above 32 u per tick)', () => {
    fc.assert(
      fc.property(mapArb, posArb, fc.double({ min: -400, max: 400, noNaN: true }), (rows, pos, dx) => {
        const world = worldFor(rows);
        fc.pre(!overlapsSolid(world, pos.x, pos.y));
        const r = moveX(world, pos.x, pos.y, dx, { ledgeForgiveness: false });
        expect(r.y).toBe(pos.y);
        expect(sweptFree(world, pos.x, pos.y, r.x, r.y)).toBe(true);
        if (!r.blocked) expect(r.x).toBeCloseTo(pos.x + dx, 6);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });

  it('moveY never passes through a solid tile or a one-way top at any speed', () => {
    fc.assert(
      fc.property(mapArb, posArb, fc.double({ min: -400, max: 400, noNaN: true }), (rows, pos, dy) => {
        const world = worldFor(rows);
        fc.pre(!overlapsSolid(world, pos.x, pos.y));
        const r = moveY(world, pos.x, pos.y, dy, {
          ignoreOneWay: false,
          cornerCorrection: false,
          preferDir: 1,
        });
        expect(r.x).toBe(pos.x);
        expect(sweptFree(world, pos.x, pos.y, r.x, r.y)).toBe(true);
        if (dy > 0) {
          // Every one-way top crossed on the way down would have caught the body.
          for (let row = Math.ceil(pos.y / TILE); row * TILE < r.y; row += 1) {
            const c0 = Math.floor((pos.x - PLAYER_SIZE.halfW) / TILE);
            const c1 = Math.ceil((pos.x + PLAYER_SIZE.halfW) / TILE) - 1;
            for (let c = c0; c <= c1; c += 1)
              expect(rows[row]?.[c], `crossed one-way at row ${String(row)}`).not.toBe('=');
          }
        }
      }),
      { seed: SEED, numRuns: 400 },
    );
  });
});

const frameArb: fc.Arbitrary<InputFrame> = fc.record({
  moveX: fc.constantFrom(-1, -0.5, 0, 0.5, 1),
  moveY: fc.constantFrom(-1, 0, 0, 1),
  held: fc.constantFrom(0, Button.Jump, Button.Jump, Button.Dash, Button.Jump | Button.Dash),
  aimMrad: fc.constant(0),
});

function assertNoPlayerInsideSolid(
  world: ReturnType<typeof createWorld>,
  cw: CollisionWorld,
  tick: number,
): void {
  for (const p of world.players) {
    if (p.mode === 'hazardRespawn' || p.mode === 'dead') continue;
    if (overlapsSolid(cw, p.x, p.y))
      throw new Error(
        `player ${String(p.slot)} inside solid at tick ${String(tick)}: (${String(p.x)}, ${String(p.y)})`,
      );
  }
}

describe('simulated players never end a tick inside solid geometry', () => {
  it('random maps, random inputs, injected extreme velocities', () => {
    fc.assert(
      fc.property(
        mapArb,
        fc.array(frameArb, { minLength: 120, maxLength: 240 }),
        fc.double({ min: -3000, max: 3000, noNaN: true }),
        fc.double({ min: -3000, max: 3000, noNaN: true }),
        (rows, frames, vx0, vy0) => {
          const level = makeLevel(rows, { spawn: [1, H - 2] });
          const world = createWorld(
            setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 2 }),
            level,
          );
          const sim = new WorldSimulation(level, { assertFinite: true });
          const cw: CollisionWorld = { level, platforms: world.platforms };
          const [a, b] = world.players;
          if (a) {
            a.vx = vx0;
            a.vy = vy0;
            a.grounded = false;
          }
          frames.forEach((frame, tick) => {
            sim.step(world, [frame, frames[(tick * 7) % frames.length] ?? frame], tick);
            assertNoPlayerInsideSolid(world, cw, tick);
          });
          expect(b).toBeDefined();
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  }, 120_000);

  it('the test arena (moving platform included), four players, random inputs', () => {
    const level = loadLevelById('test_arena');
    fc.assert(
      fc.property(
        fc.array(fc.array(frameArb, { minLength: 4, maxLength: 4 }), { minLength: 600, maxLength: 900 }),
        (ticks) => {
          const world = createWorld(setupFor(level, { seed: 7, difficulty: 'hard', playerCount: 4 }), level);
          const sim = new WorldSimulation(level, { assertFinite: true });
          const cw: CollisionWorld = { level, platforms: world.platforms };
          ticks.forEach((frames, tick) => {
            sim.step(world, frames, tick);
            assertNoPlayerInsideSolid(world, cw, tick);
          });
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  }, 120_000);
});
