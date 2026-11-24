import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const levelRoot = resolve('content/levels');
const levelFiles = [];

async function collect(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(path);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      levelFiles.push(path);
    }
  }
}

await collect(levelRoot);

if (levelFiles.length === 0) {
  console.info('No authored levels yet; full LevelLint arrives with level content.');
} else {
  const invalidFiles = [];
  for (const path of levelFiles) {
    try {
      JSON.parse(await readFile(path, 'utf8'));
    } catch {
      invalidFiles.push(path);
    }
  }

  if (invalidFiles.length > 0) {
    console.error(`Invalid level JSON:\n${invalidFiles.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.error(
      `Found ${levelFiles.length} level file(s), but full LevelLint is not available until the level-authoring milestone.`,
    );
    process.exitCode = 1;
  }
}
