// Guard until LevelLint (spec section 5.6) is built: no level files may exist before the validator does.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const levelsDir = new URL('../../content/levels/', import.meta.url).pathname;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.endsWith('.json')) yield full;
  }
}

const files = existsSync(levelsDir) ? [...walk(levelsDir)] : [];
if (files.length > 0) {
  console.error(
    `levels:lint: ${String(files.length)} level file(s) found but the LevelLint validator is not built yet.`,
  );
  console.error('Build LevelLint (reachability, spawn, exit, tile legend) before adding levels.');
  process.exit(1);
}
console.log('levels:lint: 0 levels (validator not built yet; guard only)');
