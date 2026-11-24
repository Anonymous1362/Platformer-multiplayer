import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = resolve(root, 'src');
const allowlistPath = resolve(root, 'tools/stub-scan/allowlist.json');
const allowed = JSON.parse(await readFile(allowlistPath, 'utf8'));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css']);
const markerPattern = /\b(TODO|FIXME|XXX|notImplemented)\b/g;
const findings = [];

async function visit(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) {
      continue;
    }

    const relativePath = relative(root, path).replaceAll('\\', '/');
    const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(markerPattern)) {
        const token = match[0];
        const exception = allowed[relativePath];
        if (exception?.resolvesIn && exception.tokens?.includes(token)) {
          continue;
        }
        findings.push(`${relativePath}:${index + 1}: ${token}`);
      }
    });
  }
}

await visit(sourceRoot);

if (findings.length > 0) {
  console.error(`Unresolved stub markers found:\n${findings.join('\n')}`);
  process.exitCode = 1;
} else {
  console.info('Stub scan clean.');
}
