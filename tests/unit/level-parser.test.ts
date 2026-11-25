import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/core/level/AsciiParser';
import { TileFlag } from '../../src/core/level/LevelTypes';
import { levelFiles, loadLevelById, loadLevelFile } from '../../tools/shared/levels';
import { rawLevel } from '../fixtures/levels';

const ROWS = ['######', '#....#', '#.=..#', '######'];

function errorsOf(raw: unknown): readonly string[] {
  const result = parseLevel(raw);
  return result.ok ? [] : result.errors;
}

describe('level parser (spec section 5.2)', () => {
  it('parses a level into tiles, spawn, platforms, and zones in world units', () => {
    const result = parseLevel(
      rawLevel(ROWS, {
        spawn: [1, 2],
        objects: [
          {
            id: 'mp',
            type: 'moving_platform',
            x: 1,
            y: 1,
            path: [
              [1, 1],
              [3, 1],
            ],
            speedUps: 100,
            waitMs: 500,
            oneWay: true,
          },
        ],
        zones: [{ id: 'kp', type: 'kill_plane', x: 0, y: 3, w: 6, h: 1 }],
      }),
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { level } = result;
    expect(level.widthTiles).toBe(6);
    expect(level.tiles[2 * 6 + 2]).toBe(TileFlag.OneWay);
    expect(level.tiles[0]).toBe(TileFlag.Solid);
    expect(level.spawn).toEqual({ x: 1.5 * 64, y: 3 * 64 });
    expect(level.platforms[0]).toMatchObject({ w: 192, h: 32, waitTicks: 30, oneWay: true });
    expect(level.platforms[0]?.path).toEqual([
      { x: 64, y: 64 },
      { x: 192, y: 64 },
    ]);
    expect(level.zones[0]).toMatchObject({ type: 'kill_plane', x: 0, y: 192, w: 384, h: 64 });
    expect(level.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('the hash ignores key order and formatting, but not content', () => {
    const a = parseLevel(rawLevel(ROWS));
    const reordered = Object.fromEntries(Object.entries(rawLevel(ROWS)).reverse());
    const b = parseLevel(JSON.parse(JSON.stringify(reordered, null, 4)) as unknown);
    const c = parseLevel(rawLevel(['######', '#....#', '#....#', '######']));
    if (!a.ok || !b.ok || !c.ok) throw new Error('fixture invalid');
    expect(b.level.hash).toBe(a.level.hash);
    expect(c.level.hash).not.toBe(a.level.hash);
  });

  const cases: [string, (raw: Record<string, unknown>) => unknown, RegExp][] = [
    ['not an object', () => 'level', /JSON object/],
    ['schema version', (r) => ({ ...r, schemaVersion: 2 }), /schemaVersion/],
    ['unknown key', (r) => ({ ...r, colour: 'red' }), /unknown key "colour"/],
    ['bad id', (r) => ({ ...r, id: 'Bad Id' }), /id: must match/],
    ['unknown planet', (r) => ({ ...r, planet: 'pluto' }), /unknown planet/],
    ['row count', (r) => ({ ...r, rows: ROWS.slice(0, 3) }), /expected 4 rows/],
    ['row length', (r) => ({ ...r, rows: ['#####', ...ROWS.slice(1)] }), /expected 6 characters/],
    [
      'unknown tile',
      (r) => ({ ...r, rows: ['######', '#..?.#', ...ROWS.slice(2)] }),
      /unknown tile character "\?"/,
    ],
    ['crumble not yet', (r) => ({ ...r, rows: ['######', '#..x.#', ...ROWS.slice(2)] }), /crumbling blocks/],
    ['too wide', (r) => ({ ...r, size: { w: 401, h: 4 } }), /size: w must be/],
    ['no spawn', (r) => ({ ...r, objects: [] }), /exactly one player_spawn/],
    [
      'two spawns',
      (r) => ({
        ...r,
        objects: [...(r['objects'] as unknown[]), { id: 's2', type: 'player_spawn', x: 2, y: 2 }],
      }),
      /exactly one player_spawn/,
    ],
    [
      'spawn in a wall',
      (r) => ({ ...r, objects: [{ id: 'spawn', type: 'player_spawn', x: 0, y: 1 }] }),
      /inside a wall/,
    ],
    [
      'unsupported object',
      (r) => ({ ...r, objects: [...(r['objects'] as unknown[]), { id: 'e1', type: 'enemy', x: 2, y: 2 }] }),
      /"enemy" is not supported yet/,
    ],
    [
      'duplicate id',
      (r) => ({ ...r, zones: [{ id: 'spawn', type: 'section', x: 0, y: 0, w: 1, h: 1 }] }),
      /duplicate id "spawn"/,
    ],
    [
      'zone outside',
      (r) => ({ ...r, zones: [{ id: 'z', type: 'section', x: 5, y: 0, w: 2, h: 1 }] }),
      /outside the level/,
    ],
    ['decor not yet', (r) => ({ ...r, decor: [{ piece: 'rock' }] }), /decor: entries are not supported yet/],
    [
      'platform path mismatch',
      (r) => ({
        ...r,
        objects: [
          ...(r['objects'] as unknown[]),
          {
            id: 'mp',
            type: 'moving_platform',
            x: 2,
            y: 1,
            path: [
              [1, 1],
              [3, 1],
            ],
            speedUps: 100,
            waitMs: 0,
            oneWay: true,
          },
        ],
      }),
      /must equal the first path point/,
    ],
    [
      'platform too fast',
      (r) => ({
        ...r,
        objects: [
          ...(r['objects'] as unknown[]),
          {
            id: 'mp',
            type: 'moving_platform',
            x: 1,
            y: 1,
            path: [
              [1, 1],
              [3, 1],
            ],
            speedUps: 5000,
            waitMs: 0,
            oneWay: true,
          },
        ],
      }),
      /speedUps must be/,
    ],
  ];

  for (const [label, mutate, message] of cases) {
    it(`rejects: ${label}`, () => {
      const errors = errorsOf(mutate(rawLevel(ROWS, { spawn: [1, 2] })));
      expect(errors.length, label).toBeGreaterThan(0);
      expect(errors.join('\n')).toMatch(message);
    });
  }

  it('never throws on arbitrary JSON', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(() => parseLevel(value)).not.toThrow();
      }),
      { seed: 5, numRuns: 500 },
    );
  });

  it('every shipped level parses and its file name matches its id', () => {
    const files = levelFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const result = loadLevelFile(file);
      expect(result.ok, `${file}: ${result.ok ? '' : result.errors.join('; ')}`).toBe(true);
      if (result.ok) expect(file.endsWith(`/${result.level.id}.json`)).toBe(true);
    }
    expect(loadLevelById('test_arena').platforms).toHaveLength(1);
  });
});
