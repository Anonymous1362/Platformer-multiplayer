// Re-records the golden replays in tests/golden/replays from the scripted scenarios.
// Run only after a deliberate GameConfig or simulation change, and review the diff.
// Usage: npm run golden:record
import { mkdirSync, writeFileSync } from 'node:fs';
import { ReplayRecorder } from '../../src/core/Replay';
import { hashWorld } from '../../src/core/StateHash';
import { createWorld, WorldSimulation } from '../../src/core/WorldSimulation';
import { SCENARIOS } from '../../tests/fixtures/scenarios';

const outDir = new URL('../../tests/golden/replays/', import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const scenario of SCENARIOS) {
  const world = createWorld(scenario.setup);
  const sim = new WorldSimulation({ assertFinite: true });
  const recorder = new ReplayRecorder(scenario.setup);
  for (let tick = 0; tick < scenario.ticks; tick += 1) {
    const frames = world.players.map((p) => scenario.input(tick, p.slot));
    recorder.record(frames);
    sim.step(world, frames, tick);
  }
  const replay = recorder.finish(hashWorld(world));
  // One input run per line keeps diffs readable.
  const json = JSON.stringify(replay, null, 2).replace(
    /\[\n\s+(-?\d+),\n\s+(-?\d+),\n\s+(-?\d+),\n\s+(-?\d+),\n\s+(-?\d+)\n\s+\]/g,
    '[$1, $2, $3, $4, $5]',
  );
  writeFileSync(new URL(`${scenario.name}.json`, outDir), `${json}\n`);
  console.log(`${scenario.name}: ${String(replay.ticks)} ticks, final hash ${replay.finalHash}`);
}
