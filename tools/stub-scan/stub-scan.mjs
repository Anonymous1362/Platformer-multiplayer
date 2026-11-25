// Fails on TODO, FIXME, XXX, or notImplemented in src/ unless allowlisted with the milestone that resolves it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const srcDir = join(root, 'src');
const allowlist = JSON.parse(readFileSync(new URL('./allowlist.json', import.meta.url), 'utf8'));
const pattern = /\b(TODO|FIXME|XXX|notImplemented)\b/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|mjs|css|json)$/.test(name)) yield full;
  }
}

const failures = [];
for (const file of walk(srcDir)) {
  const rel = file.slice(root.length);
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (!pattern.test(line)) return;
      const allowed = allowlist.some(
        (entry) => entry.file === rel && line.includes(entry.contains) && entry.milestone,
      );
      if (!allowed) failures.push(`${rel}:${String(index + 1)}: ${line.trim()}`);
    });
}

if (failures.length > 0) {
  console.error(`stub:scan found ${String(failures.length)} unresolved marker(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('stub:scan clean');
