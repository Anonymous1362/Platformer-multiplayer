import { describe, expect, it } from 'vitest';
import { CONFIG_HASH } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import {
  framesFromRuns,
  ReplayRecorder,
  runReplay,
  validateReplay,
  type Replay,
} from '../../src/core/Replay';
import { hashWorld } from '../../src/core/StateHash';
import { createWorld, WorldSimulation } from '../../src/core/WorldSimulation';
import { SCENARIOS } from '../fixtures/scenarios';

function record(ticks = 300): Replay {
  const scenario = SCENARIOS[0];
  if (!scenario) throw new Error('no scenario');
  const world = createWorld(scenario.setup);
  const sim = new WorldSimulation({ assertFinite: true });
  const recorder = new ReplayRecorder(scenario.setup);
  for (let tick = 0; tick < ticks; tick += 1) {
    const frames = world.players.map((p) => scenario.input(tick, p.slot));
    recorder.record(frames);
    sim.step(world, frames, tick);
  }
  return recorder.finish(hashWorld(world));
}

describe('replays (M1)', () => {
  it('run-length encodes repeated input', () => {
    const recorder = new ReplayRecorder({
      seed: 1,
      planet: 'kepler',
      difficulty: 'normal',
      playerCount: 1,
      floorY: 500,
      worldWidth: 1000,
      spawnX: 10,
    });
    for (let i = 0; i < 100; i += 1) recorder.record([{ moveX: 1, moveY: 0, held: 0, aimMrad: 0 }]);
    for (let i = 0; i < 3; i += 1) recorder.record([{ moveX: 0, moveY: 0, held: Button.Jump, aimMrad: 0 }]);
    const replay = recorder.finish('00000000');
    expect(replay.inputs[0]).toEqual([
      [100, 127, 0, 0, 0],
      [3, 0, 0, 1, 0],
    ]);
    expect(replay.ticks).toBe(103);
    expect(replay.configHash).toBe(CONFIG_HASH);
    expect([...framesFromRuns(replay.inputs[0] ?? [])]).toHaveLength(103);
  });

  it('reproduces the recorded final hash', () => {
    const replay = record();
    const result = runReplay(replay);
    expect(result).toEqual({
      finalHash: replay.finalHash,
      ticks: 300,
      configMatches: true,
      hashMatches: true,
    });
  });

  it('survives a JSON round trip', () => {
    const replay = record();
    const parsed = validateReplay(JSON.parse(JSON.stringify(replay)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(runReplay(parsed.replay).hashMatches).toBe(true);
  });

  it('detects tampered input', () => {
    const replay = record();
    const runs = replay.inputs[0]?.map((run) => [...run] as typeof run) ?? [];
    const first = runs[0];
    if (!first) throw new Error('no runs');
    first[3] = first[3] === 0 ? Button.Jump : 0;
    const tampered: Replay = { ...replay, inputs: [runs, ...replay.inputs.slice(1)] };
    expect(runReplay(tampered).hashMatches).toBe(false);
  });

  it('rejects malformed replays without throwing', () => {
    const good = JSON.parse(JSON.stringify(record(60))) as Record<string, unknown>;
    const cases: [string, unknown][] = [
      ['null', null],
      ['format', { ...good, format: 'other' }],
      ['version', { ...good, version: 2 }],
      ['hash', { ...good, finalHash: 'xyz' }],
      ['ticks', { ...good, ticks: 61 }],
      ['setup', { ...good, setup: { ...(good['setup'] as object), planet: 'pluto' } }],
      ['player count', { ...good, inputs: [] }],
      ['range', { ...good, inputs: [[[60, 500, 0, 0, 0]], [[60, 0, 0, 0, 0]]] }],
      ['nan', { ...good, inputs: [[[60, Number.NaN, 0, 0, 0]], [[60, 0, 0, 0, 0]]] }],
    ];
    for (const [label, raw] of cases) {
      const result = validateReplay(raw);
      expect(result.ok, label).toBe(false);
    }
  });
});
