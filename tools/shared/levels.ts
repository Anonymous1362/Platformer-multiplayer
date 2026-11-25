// Node-side level loading shared by tools and tests. The game itself never reads the file system.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel } from '../../src/core/level/AsciiParser';
import type { Level } from '../../src/core/level/LevelTypes';

export const LEVELS_DIR = fileURLToPath(new URL('../../content/levels/', import.meta.url));

/** Every `*.json` under content/levels, sorted for stable output. */
export function levelFiles(dir: string = LEVELS_DIR): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.json')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

export type LoadResult =
  | { readonly ok: true; readonly file: string; readonly level: Level }
  | { readonly ok: false; readonly file: string; readonly errors: readonly string[] };

export function loadLevelFile(file: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error: unknown) {
    return {
      ok: false,
      file,
      errors: [`not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
  const parsed = parseLevel(raw);
  return parsed.ok ? { ok: true, file, level: parsed.level } : { ok: false, file, errors: parsed.errors };
}

/** Loads the level whose `id` matches; throws with a readable message otherwise. */
export function loadLevelById(id: string, dir: string = LEVELS_DIR): Level {
  for (const file of levelFiles(dir)) {
    if (!file.endsWith(`/${id}.json`)) continue;
    const result = loadLevelFile(file);
    if (!result.ok) throw new Error(`${relative(process.cwd(), file)}: ${result.errors.join('; ')}`);
    if (result.level.id !== id) throw new Error(`${file}: file name and id "${result.level.id}" differ`);
    return result.level;
  }
  throw new Error(`no level with id "${id}" under ${dir}`);
}
