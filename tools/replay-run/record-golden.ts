// Re-records the golden replays in tests/golden/replays from the scripted scenarios.
// Run only after a deliberate GameConfig, simulation, or level change, and review the diff.
// Usage: npm run golden:record
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ReplayRecorder } from '../../src/core/Replay';
import { hashWorld } from '../../src/core/StateHash';
import { createWorld, WorldSimulation } from '../../src/core/WorldSimulation';
import { scenarioDriver, scenarioSetup, SCENARIOS } from '../../tests/fixtures/scenarios';
import { loadLevelById } from '../shared/levels';

const outDir = fileURLToPath(new URL('../../tests/golden/replays/', import.meta.url));
mkdirSync(outDir, { recursive: true });
// Recordings for scenarios that no longer exist would fail the golden test; remove them.
const wanted = new Set(SCENARIOS.map((s) => `${s.name}.json`));
for (const name of readdirSync(outDir))
  if (name.endsWith('.json') && !wanted.has(name)) rmSync(`${outDir}${name}`);

for (const scenario of SCENARIOS) {
  const level = loadLevelById(scenario.levelId);
  const setup = scenarioSetup(scenario, level);
  const world = createWorld(setup, level);
  const sim = new WorldSimulation(level, { assertFinite: true });
  const recorder = new ReplayRecorder(setup);
  const drive = scenarioDriver(scenario, level);
  for (let tick = 0; tick < scenario.ticks; tick += 1) {
    const frames = drive(tick, world);
    recorder.record(frames);
    sim.step(world, frames, tick);
    recorder.afterStep(world);
  }
  const replay = recorder.finish(hashWorld(world));
  // One input run per line keeps diffs readable.
  const json = JSON.stringify(replay, null, 2)
    .replace(/"checkpoints": \[[^\]]*\]/, (m) => m.replace(/\s+/g, ' ').replace('[ ', '[').replace(' ]', ']'))
    .replace(
      /\[\n\s+(-?\d+),\n\s+(-?\d+),\n\s+(-?\d+),\n\s+(-?\d+),\n\s+(-?\d+)\n\s+\]/g,
      '[$1, $2, $3, $4, $5]',
    );
  writeFileSync(`${outDir}${scenario.name}.json`, `${json}\n`);
  console.log(
    `${scenario.name}: ${String(replay.ticks)} ticks on ${level.id}, final hash ${replay.finalHash}`,
  );
}
