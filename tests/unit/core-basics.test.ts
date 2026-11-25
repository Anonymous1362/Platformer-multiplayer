import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { atan2, cos, PI, sin, SIN_TABLE_SIZE, sinTableEntry, TAU } from '../../src/core/DMath';
import {
  allocateEntity,
  createAllocator,
  entityGeneration,
  entityIndex,
  freeEntity,
  isEntityAlive,
  NO_ENTITY,
} from '../../src/core/EntityIds';
import { CONFIG_HASH, configHashOf, DT, GameConfig, msToTicks, Ticks } from '../../src/core/GameConfig';
import { canonicalJson, Fnv1a32, fnv1aHex } from '../../src/core/Hash';
import { DIFFICULTY_IDS, PLANET_IDS } from '../../src/core/Ids';
import { NEUTRAL_INPUT, quantizeAxis, sanitizeInputFrame } from '../../src/core/InputSanitize';

describe('FNV-1a and canonical JSON', () => {
  it('matches the published FNV-1a 32-bit test vectors', () => {
    expect(fnv1aHex('')).toBe('811c9dc5');
    expect(fnv1aHex('a')).toBe('e40c292c');
    expect(fnv1aHex('foobar')).toBe('bf9cf968');
  });

  it('distinguishes 0 from -0 and every bit of a double', () => {
    expect(new Fnv1a32().f64(0).hex()).not.toBe(new Fnv1a32().f64(-0).hex());
    expect(new Fnv1a32().f64(0.1 + 0.2).hex()).not.toBe(new Fnv1a32().f64(0.3).hex());
  });

  it('sorts keys recursively and rejects non-finite numbers', () => {
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(RangeError);
    expect(() => canonicalJson({ a: undefined })).toThrow(TypeError);
  });
});

describe('GameConfig (N9)', () => {
  it('derives tick counts that match spec section 4.1', () => {
    expect(DT).toBe(1 / 60);
    expect(Ticks).toEqual({
      coyote: 7,
      jumpBuffer: 8,
      jumpCutMinHold: 3,
      wallJumpLock: 7,
      dash: 10,
      dashCooldown: 57,
      dashIframes: 8,
      dropThroughGrace: 9,
      slamStun: 24,
      slamRecovery: 7,
    });
    expect(msToTicks(0)).toBe(0);
  });

  it('hashes the canonical config; any change changes the hash, key order does not', () => {
    expect(CONFIG_HASH).toMatch(/^[0-9a-f]{8}$/);
    expect(configHashOf(GameConfig)).toBe(CONFIG_HASH);
    expect(configHashOf({ ...GameConfig, sim: { ...GameConfig.sim, tickRate: 61 } })).not.toBe(CONFIG_HASH);
    const { sim, ...rest } = GameConfig;
    expect(configHashOf({ ...rest, sim })).toBe(CONFIG_HASH);
  });

  it('orders difficulties from easiest to hardest (spec section 3.4)', () => {
    const d = GameConfig.difficulty;
    expect(d.easy.damageTakenPct).toBeLessThan(d.normal.damageTakenPct);
    expect(d.normal.damageTakenPct).toBeLessThan(d.hard.damageTakenPct);
    expect(d.hard.damageTakenPct).toBeLessThan(d.drift_plus.damageTakenPct);
    expect(d.hard.elitePct).toBeLessThan(d.drift_plus.elitePct);
    for (const id of DIFFICULTY_IDS) expect(Object.keys(d[id]).sort()).toEqual(Object.keys(d.normal).sort());
  });
});

describe('ID unions match spec Appendix B', () => {
  const spec = readFileSync(new URL('../../docs/MASTER_SPEC.md', import.meta.url), 'utf8');
  const row = (group: string): string[] => {
    const line = spec.split('\n').find((l) => l.startsWith(`| ${group} |`));
    if (!line) throw new Error(`Appendix B row "${group}" not found`);
    return [...(line.split('|')[2] ?? '').matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1] ?? '');
  };
  it('planets and difficulties', () => {
    expect([...PLANET_IDS]).toEqual(row('Planets'));
    expect([...DIFFICULTY_IDS]).toEqual(row('Difficulties'));
  });
});

describe('DMath', () => {
  it('sin and cos stay within 1e-6 of the engine functions', () => {
    let worst = 0;
    for (let i = 0; i <= 20000; i += 1) {
      const x = (i / 20000) * 20 * PI - 10 * PI;
      worst = Math.max(worst, Math.abs(sin(x) - Math.sin(x)), Math.abs(cos(x) - Math.cos(x)));
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it('hits exact quadrant values and is periodic', () => {
    expect(sin(0)).toBe(0);
    expect(sin(PI / 2)).toBe(1);
    expect(sin((3 * PI) / 2)).toBe(-1);
    expect(Math.abs(sin(PI))).toBeLessThan(1e-12);
    expect(Math.abs(sin(1.234 + TAU * 5) - sin(1.234))).toBeLessThan(1e-9);
    expect(sin(Number.NaN)).toBe(0);
  });

  it('atan2 stays within 5e-6 rad of the engine function in every quadrant', () => {
    let worst = 0;
    for (let i = 0; i < 5000; i += 1) {
      const a = (i / 5000) * TAU - PI + 1e-4;
      const r = 1 + (i % 9);
      const y = Math.sin(a) * r;
      const x = Math.cos(a) * r;
      worst = Math.max(worst, Math.abs(atan2(y, x) - Math.atan2(y, x)));
    }
    expect(worst).toBeLessThan(5e-6);
    expect(atan2(0, 0)).toBe(0);
    expect(atan2(1, 0)).toBeCloseTo(PI / 2, 12);
    expect(atan2(0, -1)).toBeCloseTo(PI, 12);
  });

  it('builds the same table every time (regression pin)', () => {
    const h = new Fnv1a32();
    for (let i = 0; i <= SIN_TABLE_SIZE; i += 1) h.f64(sinTableEntry(i));
    expect(h.hex()).toBe(TABLE_HASH);
  });
});

describe('entity IDs with generations (N4)', () => {
  it('allocates, frees, and reuses slots oldest-first with a new generation', () => {
    const a = createAllocator(3);
    const ids = [allocateEntity(a), allocateEntity(a), allocateEntity(a)];
    expect(ids).toEqual([65536, 65537, 65538]);
    expect(allocateEntity(a)).toBeNull();
    const first = ids[0] ?? NO_ENTITY;
    expect(freeEntity(a, first)).toBe(true);
    expect(freeEntity(a, first)).toBe(false);
    const reused = allocateEntity(a) ?? NO_ENTITY;
    expect(entityIndex(reused)).toBe(0);
    expect(entityGeneration(reused)).toBe(2);
    expect(isEntityAlive(a, first)).toBe(false);
    expect(isEntityAlive(a, reused)).toBe(true);
  });

  it('wraps generations without ever producing generation 0', () => {
    const a = createAllocator(1);
    a.generations[0] = 65535;
    expect(entityGeneration(allocateEntity(a) ?? NO_ENTITY)).toBe(1);
  });

  it('rejects invalid IDs and capacities', () => {
    const a = createAllocator(4);
    for (const bad of [NO_ENTITY, -1, 1.5, Number.NaN, 65536 * 9 + 3])
      expect(isEntityAlive(a, bad)).toBe(false);
    expect(() => createAllocator(0)).toThrow(RangeError);
    expect(() => createAllocator(65537)).toThrow(RangeError);
  });

  it('keeps its invariants under random allocate/free sequences (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.boolean(), fc.nat(20)), { maxLength: 300 }), (ops) => {
        const a = createAllocator(16);
        const live: number[] = [];
        for (const [alloc, pick] of ops) {
          if (alloc) {
            const id = allocateEntity(a);
            if (id !== null) live.push(id);
          } else if (live.length > 0) {
            const [id] = live.splice(pick % live.length, 1);
            if (id === undefined || !freeEntity(a, id)) return false;
          }
        }
        const aliveCount = a.alive.filter(Boolean).length;
        return (
          aliveCount === live.length &&
          aliveCount + a.freeList.length === a.capacity &&
          new Set(a.freeList).size === a.freeList.length &&
          live.every((id) => isEntityAlive(a, id))
        );
      }),
    );
  });
});

describe('input sanitizing at the simulation boundary (N11)', () => {
  it('quantizes axes like the network does (i8, x127)', () => {
    expect(quantizeAxis(1)).toBe(127);
    expect(quantizeAxis(-1)).toBe(-127);
    expect(quantizeAxis(0.5)).toBe(64);
    expect(quantizeAxis(7)).toBe(127);
    expect(quantizeAxis(Number.NaN)).toBe(0);
    expect(Object.is(quantizeAxis(-0.001), 0)).toBe(true);
  });

  it('masks buttons, clamps aim, and replaces a missing frame with neutral input', () => {
    expect(sanitizeInputFrame({ moveX: 0, moveY: 0, held: 0xff, aimMrad: 99999 })).toEqual({
      moveX: 0,
      moveY: 0,
      held: 0b111111,
      aimMrad: 3142,
    });
    expect(sanitizeInputFrame({ moveX: 0, moveY: 0, held: 2.5, aimMrad: -0.2 }).held).toBe(0);
    expect(sanitizeInputFrame(undefined)).toEqual(NEUTRAL_INPUT);
  });

  it('is idempotent for any input (property)', () => {
    fc.assert(
      fc.property(fc.double(), fc.double(), fc.integer(), fc.double(), (moveX, moveY, held, aimMrad) => {
        const once = sanitizeInputFrame({ moveX, moveY, held, aimMrad });
        const twice = sanitizeInputFrame(once);
        return (
          Object.is(once.moveX, twice.moveX) &&
          Object.is(once.moveY, twice.moveY) &&
          once.held === twice.held &&
          once.aimMrad === twice.aimMrad &&
          Math.abs(once.moveX) <= 1
        );
      }),
    );
  });
});

/** Regression pin for the deterministic sine table; recompute only if the table algorithm changes on purpose. */
const TABLE_HASH = 'db037755';
