import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG_HASH } from '../../src/core/GameConfig';
import { ReplayRecorder, runReplay, validateReplay } from '../../src/core/Replay';
import { hashWorld } from '../../src/core/StateHash';
import { createWorld, WorldSimulation } from '../../src/core/WorldSimulation';
import { SCENARIOS } from '../fixtures/scenarios';

const dir = new URL('./replays/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const RERECORD =
  'GameConfig or the simulation changed: if that was deliberate, run `npm run golden:record` and review the diff.';

describe('golden replays (O2)', () => {
  it('has one recorded replay per scenario', () => {
    expect(files.sort()).toEqual(SCENARIOS.map((s) => `${s.name}.json`).sort());
  });

  for (const file of files) {
    it(`${file} reproduces its final hash`, () => {
      const parsed = validateReplay(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
      if (!parsed.ok) throw new Error(`${file}: ${parsed.error}`);
      const { replay } = parsed;
      expect(replay.configHash, `${file} seed ${String(replay.setup.seed)}: ${RERECORD}`).toBe(CONFIG_HASH);
      const result = runReplay(replay);
      expect(result.finalHash, `${file} seed ${String(replay.setup.seed)}: ${RERECORD}`).toBe(
        replay.finalHash,
      );
    });
  }

  for (const scenario of SCENARIOS) {
    it(`${scenario.name}: the live scenario still matches its recording`, () => {
      const world = createWorld(scenario.setup);
      const sim = new WorldSimulation({ assertFinite: true });
      const recorder = new ReplayRecorder(scenario.setup);
      for (let tick = 0; tick < scenario.ticks; tick += 1) {
        const frames = world.players.map((p) => scenario.input(tick, p.slot));
        recorder.record(frames);
        sim.step(world, frames, tick);
      }
      const live = recorder.finish(hashWorld(world));
      const parsed = validateReplay(JSON.parse(readFileSync(new URL(`${scenario.name}.json`, dir), 'utf8')));
      if (!parsed.ok) throw new Error(parsed.error);
      expect(live.inputs).toEqual(parsed.replay.inputs);
      expect(live.finalHash, RERECORD).toBe(parsed.replay.finalHash);
    });
  }
});
