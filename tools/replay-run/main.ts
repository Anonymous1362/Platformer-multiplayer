// Headless replay runner (spec section 20.3): prints the final state hash of a replay file.
// Usage: npm run replay:run -- <replay.json>
import { readFileSync } from 'node:fs';
import { CONFIG_HASH } from '../../src/core/GameConfig';
import { runReplay, validateReplay } from '../../src/core/Replay';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run replay:run -- <replay.json>');
  process.exit(2);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(file, 'utf8'));
} catch (error: unknown) {
  console.error(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const parsed = validateReplay(raw);
if (!parsed.ok) {
  console.error(`invalid replay: ${parsed.error}`);
  process.exit(2);
}

const { replay } = parsed;
const result = runReplay(replay);
console.log(
  JSON.stringify(
    {
      file,
      seed: replay.setup.seed,
      ticks: result.ticks,
      finalHash: result.finalHash,
      expectedHash: replay.finalHash,
      hashMatches: result.hashMatches,
      replayConfigHash: replay.configHash,
      buildConfigHash: CONFIG_HASH,
      configMatches: result.configMatches,
    },
    null,
    2,
  ),
);
process.exit(result.hashMatches && result.configMatches ? 0 : 1);
