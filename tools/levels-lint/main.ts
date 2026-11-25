// LevelLint, first stage (spec section 5.6 item 1): every level under content/levels must parse with
// the game's own parser (schema, sizes, tile legend, objects, zones, spawn not inside a wall) and its
// file name must match its id. Reachability, exits, and checkpoint spacing arrive with Pass 2F.
// Usage: npm run levels:lint
import { basename, relative } from 'node:path';
import { levelFiles, loadLevelFile } from '../shared/levels';

const files = levelFiles();
let failed = 0;
for (const file of files) {
  const shown = relative(process.cwd(), file);
  const result = loadLevelFile(file);
  if (!result.ok) {
    failed += 1;
    console.error(`✗ ${shown}`);
    for (const error of result.errors) console.error(`    ${error}`);
    continue;
  }
  if (basename(file) !== `${result.level.id}.json`) {
    failed += 1;
    console.error(`✗ ${shown}: file name must be ${result.level.id}.json`);
    continue;
  }
  const { level } = result;
  console.log(
    `✓ ${shown}  ${String(level.widthTiles)}×${String(level.heightTiles)} ${level.planet}, ${String(level.platforms.length)} platform(s), hash ${level.hash}`,
  );
}
console.log(
  `levels:lint: ${String(files.length)} level(s), ${String(failed)} failed (schema stage; reachability comes in Pass 2F)`,
);
process.exit(failed === 0 ? 0 : 1);
