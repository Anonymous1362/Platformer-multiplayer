import { describe, expect, it } from 'vitest';
import { freeEntity, isEntityAlive } from '../../src/core/EntityIds';
import { NonFiniteStateError } from '../../src/core/FiniteGuard';
import type { InputFrame } from '../../src/core/InputTypes';
import type { Level } from '../../src/core/level/LevelTypes';
import type { WorldSetup, WorldState } from '../../src/core/SimulationTypes';
import { hashWorld } from '../../src/core/StateHash';
import { approach, cloneWorld, createWorld, setupFor, WorldSimulation } from '../../src/core/WorldSimulation';
import { loadLevelById } from '../../tools/shared/levels';
import { flatLevel } from '../fixtures/levels';
import { scenarioSetup, SCENARIOS, scriptedInput, type Scenario } from '../fixtures/scenarios';

const ARENA: Level = loadLevelById('test_arena');

function inputsAt(scenario: Scenario, world: WorldState, tick: number): InputFrame[] {
  return world.players.map((p) => scenario.input(tick, p.slot));
}

function runScenario(scenario: Scenario, setup: WorldSetup = scenarioSetup(scenario, ARENA)) {
  const world = createWorld(setup, ARENA);
  const sim = new WorldSimulation(ARENA, { assertFinite: true });
  const checkpoints: string[] = [];
  for (let tick = 0; tick < scenario.ticks; tick += 1) {
    sim.step(world, inputsAt(scenario, world, tick), tick);
    if (world.tick % 60 === 0) checkpoints.push(hashWorld(world));
  }
  return { world, checkpoints, finalHash: hashWorld(world) };
}

const flatCache = new Map<string, Level>();
/** One flat test level per planet (cached so world and simulation share the same instance). */
function flat(planet: 'kepler' | 'cryos' | 'aether'): Level {
  const cached = flatCache.get(planet);
  if (cached) return cached;
  const level = flatLevel(planet, 40, 12);
  flatCache.set(planet, level);
  return level;
}

describe('deterministic simulation', () => {
  for (const scenario of SCENARIOS) {
    it(`same seed and inputs give the same hashes every 60 ticks (${scenario.name}, seed ${String(scenario.seed)})`, () => {
      const a = runScenario(scenario);
      const b = runScenario(scenario);
      expect(b.checkpoints).toEqual(a.checkpoints);
      expect(b.finalHash).toBe(a.finalHash);
      expect(a.checkpoints).toHaveLength(Math.floor(scenario.ticks / 60));
      expect(new Set(a.checkpoints).size).toBeGreaterThan(1); // the state really evolves
    });
  }

  it('different seeds give different hashes', () => {
    const scenario = SCENARIOS[0];
    if (!scenario) throw new Error('no scenario');
    const a = runScenario(scenario);
    const b = runScenario(scenario, { ...scenarioSetup(scenario, ARENA), seed: scenario.seed + 1 });
    expect(b.finalHash).not.toBe(a.finalHash);
  });

  it('a snapshot resumes to exactly the same result as an uninterrupted run', () => {
    const scenario = SCENARIOS[1];
    if (!scenario) throw new Error('no scenario');
    const full = runScenario(scenario);

    const world = createWorld(scenarioSetup(scenario, ARENA), ARENA);
    const sim = new WorldSimulation(ARENA, { assertFinite: true });
    for (let tick = 0; tick < 500; tick += 1) sim.step(world, inputsAt(scenario, world, tick), tick);
    const snapshot = cloneWorld(world);
    sim.step(world, inputsAt(scenario, world, 500), 500); // the original keeps going independently
    for (let tick = 500; tick < scenario.ticks; tick += 1)
      sim.step(snapshot, inputsAt(scenario, snapshot, tick), tick);
    expect(hashWorld(snapshot)).toBe(full.finalHash);
  });

  it('sanitizes garbage input instead of corrupting the state', () => {
    const world = createWorld(
      setupFor(flat('cryos'), { seed: 5, difficulty: 'easy', playerCount: 2 }),
      flat('cryos'),
    );
    const sim = new WorldSimulation(flat('cryos'), { assertFinite: true });
    const garbage: InputFrame[] = [
      { moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY, held: 1.5, aimMrad: Number.NaN },
      { moveX: 1e9, moveY: -1e9, held: 0xffff, aimMrad: 1e9 },
    ];
    for (let tick = 0; tick < 120; tick += 1) sim.step(world, garbage, tick);
    expect(world.players[1]?.held).toBe(0b1111111);
    expect(world.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it('a NaN velocity neither hangs a tick nor slips past the assertion', () => {
    const level = flat('kepler');
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1e300]) {
      const world = createWorld(setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 1 }), level);
      const player = world.players[0];
      if (!player) throw new Error('no player');
      player.vy = value;
      player.grounded = false;
      const sim = new WorldSimulation(level, { assertFinite: Number.isFinite(value) });
      sim.step(world, [{ moveX: 0, moveY: 0, held: 0, aimMrad: 0 }], 0);
      if (Number.isFinite(value)) expect(Number.isFinite(player.y)).toBe(true);
    }
  });

  it('the dev assertion names the first non-finite field (N11)', () => {
    const world = createWorld(
      setupFor(flat('kepler'), { seed: 1, difficulty: 'normal', playerCount: 1 }),
      flat('kepler'),
    );
    const sim = new WorldSimulation(flat('kepler'), { assertFinite: true });
    const player = world.players[0];
    if (!player) throw new Error('no player');
    const run = { moveX: 1, moveY: 0, held: 0, aimMrad: 0 };
    player.vx = Number.NaN;
    expect(() => sim.step(world, [run], 0)).toThrow(NonFiniteStateError);
    try {
      player.vx = Number.NaN;
      sim.step(world, [run], 1);
    } catch (error) {
      expect(error).toBeInstanceOf(NonFiniteStateError);
      expect((error as NonFiniteStateError).path).toBe('state.players[0].x');
    }
  });

  it('refuses a simulation built for a different level', () => {
    const world = createWorld(
      setupFor(flat('kepler'), { seed: 1, difficulty: 'normal', playerCount: 1 }),
      flat('kepler'),
    );
    expect(() => new WorldSimulation(ARENA).step(world, [scriptedInput(0, 0)], 0)).toThrow(/not test_arena/);
  });

  it('refuses a wrong tick or a wrong number of inputs', () => {
    const world = createWorld(
      setupFor(flat('aether'), { seed: 1, difficulty: 'normal', playerCount: 2 }),
      flat('aether'),
    );
    const sim = new WorldSimulation(flat('aether'));
    expect(() => sim.step(world, [scriptedInput(0, 0), scriptedInput(0, 1)], 3)).toThrow();
    expect(() => sim.step(world, [scriptedInput(0, 0)], 0)).toThrow(RangeError);
  });

  it('rejects invalid setups', () => {
    const level = flat('kepler');
    const good = setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 1 });
    expect(() => createWorld(good, level)).not.toThrow();
    expect(() => createWorld({ ...good, playerCount: 5 }, level)).toThrow(RangeError);
    expect(() => createWorld({ ...good, seed: 1.5 }, level)).toThrow(RangeError);
    expect(() => createWorld({ ...good, levelHash: 'nothex!!' }, level)).toThrow(RangeError);
    expect(() => createWorld({ ...good, levelHash: '00000000' }, level)).toThrow(/loaded level/);
    expect(() => createWorld(good, ARENA)).toThrow(/loaded level/);
  });

  it('player IDs carry generations; a freed ID goes stale (N4)', () => {
    const world = createWorld(
      setupFor(flat('kepler'), { seed: 1, difficulty: 'normal', playerCount: 3 }),
      flat('kepler'),
    );
    const id = world.players[1]?.id ?? 0;
    expect(isEntityAlive(world.entities, id)).toBe(true);
    expect(freeEntity(world.entities, id)).toBe(true);
    expect(isEntityAlive(world.entities, id)).toBe(false);
  });
});

describe('approach()', () => {
  it('never hides a NaN (regression: it used to snap NaN to the target)', () => {
    expect(Number.isNaN(approach(Number.NaN, 420, 60))).toBe(true);
    expect(approach(0, 420, 60)).toBe(60);
    expect(approach(400, 420, 60)).toBe(420);
    expect(approach(-10, -420, 60)).toBe(-70);
    expect(approach(5, 5, 60)).toBe(5);
  });
});
