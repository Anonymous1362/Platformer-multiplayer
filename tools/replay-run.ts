import { readFileSync } from 'node:fs';
import { CONFIG_HASH } from '../src/core/GameConfig.ts';
import { parseReplayData } from '../src/core/ReplayRecorder.ts';
import { hashWorldState } from '../src/core/StateHash.ts';
import { WorldSimulation } from '../src/core/WorldSimulation.ts';

function runReplayFile(filePath: string): void {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  const replay = parseReplayData(parsed);
  if (replay.configHash !== CONFIG_HASH) {
    throw new Error(`Replay config mismatch: file=${replay.configHash}, runtime=${CONFIG_HASH}.`);
  }

  const simulation = new WorldSimulation();
  let state = simulation.createState(replay.seed, replay.playerCount);
  for (const run of replay.runs) {
    for (let repetition = 0; repetition < run.count; repetition += 1) {
      state = simulation.step(state, run.inputs);
    }
  }

  const actualHash = hashWorldState(state);
  if (actualHash !== replay.finalStateHash) {
    throw new Error(
      `Replay state mismatch at tick ${state.tick}: expected ${replay.finalStateHash}, got ${actualHash}.`,
    );
  }

  console.log(`Replay verified: tick=${state.tick} state=${actualHash} config=${CONFIG_HASH}`);
}

const filePath = process.argv[2];
if (filePath === undefined) {
  console.error('Usage: npm run replay:run -- <replay.json>');
  process.exitCode = 2;
} else {
  try {
    runReplayFile(filePath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Replay verification failed.');
    process.exitCode = 1;
  }
}
