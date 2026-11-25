import { describe, expect, it } from 'vitest';
import { freeEntity, isEntityAlive } from '../../src/core/EntityIds';
import { NonFiniteStateError } from '../../src/core/FiniteGuard';
import type { InputFrame } from '../../src/core/InputTypes';
import type { WorldSetup, WorldState } from '../../src/core/SimulationTypes';
import { hashWorld } from '../../src/core/StateHash';
import { approach, cloneWorld, createWorld, WorldSimulation } from '../../src/core/WorldSimulation';
import { SCENARIOS, scriptedInput, type Scenario } from '../fixtures/scenarios';

function inputsAt(scenario: Scenario, world: WorldState, tick: number): InputFrame[] {
  return world.players.map((p) => scenario.input(tick, p.slot));
}

function runScenario(scenario: Scenario, setup: WorldSetup = scenario.setup) {
  const world = createWorld(setup);
  const sim = new WorldSimulation({ assertFinite: true });
  const checkpoints: string[] = [];
  for (let tick = 0; tick < scenario.ticks; tick += 1) {
    sim.step(world, inputsAt(scenario, world, tick), tick);
    if (world.tick % 60 === 0) checkpoints.push(hashWorld(world));
  }
  return { world, checkpoints, finalHash: hashWorld(world) };
}

describe('deterministic simulation', () => {
  for (const scenario of SCENARIOS) {
    it(`same seed and inputs give the same hashes every 60 ticks (${scenario.name}, seed ${String(scenario.setup.seed)})`, () => {
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
    const b = runScenario(scenario, { ...scenario.setup, seed: scenario.setup.seed + 1 });
    expect(b.finalHash).not.toBe(a.finalHash);
  });

  it('a snapshot resumes to exactly the same result as an uninterrupted run', () => {
    const scenario = SCENARIOS[1];
    if (!scenario) throw new Error('no scenario');
    const full = runScenario(scenario);

    const world = createWorld(scenario.setup);
    const sim = new WorldSimulation({ assertFinite: true });
    for (let tick = 0; tick < 500; tick += 1) sim.step(world, inputsAt(scenario, world, tick), tick);
    const snapshot = cloneWorld(world);
    sim.step(world, inputsAt(scenario, world, 500), 500); // the original keeps going independently
    for (let tick = 500; tick < scenario.ticks; tick += 1)
      sim.step(snapshot, inputsAt(scenario, snapshot, tick), tick);
    expect(hashWorld(snapshot)).toBe(full.finalHash);
  });

  it('sanitizes garbage input instead of corrupting the state', () => {
    const world = createWorld({
      seed: 5,
      planet: 'cryos',
      difficulty: 'easy',
      playerCount: 2,
      floorY: 900,
      worldWidth: 2000,
      spawnX: 100,
    });
    const sim = new WorldSimulation({ assertFinite: true });
    const garbage: InputFrame[] = [
      { moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY, held: 1.5, aimMrad: Number.NaN },
      { moveX: 1e9, moveY: -1e9, held: 0xffff, aimMrad: 1e9 },
    ];
    for (let tick = 0; tick < 120; tick += 1) sim.step(world, garbage, tick);
    expect(world.players[1]?.held).toBe(0b111111);
    expect(world.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it('the dev assertion names the first non-finite field (N11)', () => {
    const world = createWorld({
      seed: 1,
      planet: 'kepler',
      difficulty: 'normal',
      playerCount: 1,
      floorY: 500,
      worldWidth: 1000,
      spawnX: 10,
    });
    const sim = new WorldSimulation({ assertFinite: true });
    const player = world.players[0];
    if (!player) throw new Error('no player');
    player.vx = Number.NaN;
    expect(() => sim.step(world, [scriptedInput(0, 0)], 0)).toThrow(NonFiniteStateError);
    try {
      player.vx = Number.NaN;
      sim.step(world, [scriptedInput(1, 0)], 1);
    } catch (error) {
      expect(error).toBeInstanceOf(NonFiniteStateError);
      expect((error as NonFiniteStateError).path).toBe('state.players[0].x');
    }
  });

  it('refuses a wrong tick or a wrong number of inputs', () => {
    const world = createWorld({
      seed: 1,
      planet: 'aether',
      difficulty: 'normal',
      playerCount: 2,
      floorY: 500,
      worldWidth: 1000,
      spawnX: 10,
    });
    const sim = new WorldSimulation();
    expect(() => sim.step(world, [scriptedInput(0, 0), scriptedInput(0, 1)], 3)).toThrow();
    expect(() => sim.step(world, [scriptedInput(0, 0)], 0)).toThrow(RangeError);
  });

  it('rejects invalid setups', () => {
    const good: WorldSetup = {
      seed: 1,
      planet: 'kepler',
      difficulty: 'normal',
      playerCount: 1,
      floorY: 500,
      worldWidth: 1000,
      spawnX: 10,
    };
    expect(() => createWorld({ ...good, playerCount: 5 })).toThrow(RangeError);
    expect(() => createWorld({ ...good, floorY: Number.NaN })).toThrow(RangeError);
    expect(() => createWorld({ ...good, seed: 1.5 })).toThrow(RangeError);
    expect(() => createWorld({ ...good, spawnX: 990, playerCount: 2 })).toThrow(RangeError);
  });

  it('player IDs carry generations; a freed ID goes stale (N4)', () => {
    const world = createWorld({
      seed: 1,
      planet: 'kepler',
      difficulty: 'normal',
      playerCount: 3,
      floorY: 500,
      worldWidth: 1000,
      spawnX: 10,
    });
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
