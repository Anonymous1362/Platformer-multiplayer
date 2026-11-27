import { GameConfig, msToTicks } from '../GameConfig';
import { canonicalJson, fnv1aHex } from '../Hash';
import { isPlanetId, type PlanetId } from '../Ids';
import {
  ENEMY_ARCHETYPES,
  LEVEL_LIMITS,
  TILE_LEGEND,
  TileFlag,
  ZONE_TYPES,
  type EnemyArchetype,
  type EnemySpawn,
  type Level,
  type LevelPoint,
  type LevelZone,
  type PlatformDef,
  type ZoneType,
} from './LevelTypes';

/**
 * Level JSON → `Level` (spec section 5.2). This is the boundary for untrusted content (N11): it never
 * throws, rejects unknown keys and object types, and reports every problem it finds.
 */
export type LevelParseResult =
  { readonly ok: true; readonly level: Level } | { readonly ok: false; readonly errors: readonly string[] };

const TILE = GameConfig.world.tileSizeU;
const P = GameConfig.player;
const ID_RE = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_ERRORS = 50;
const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'id',
  'planet',
  'nameKey',
  'size',
  'parTimeSec',
  'musicId',
  'rows',
  'objects',
  'zones',
  'decor',
  'triggers',
]);
/** Default moving-platform size in tiles when the level omits `w`/`h`. */
const DEFAULT_PLATFORM_W_TILES = 3;
const DEFAULT_PLATFORM_H_TILES = 0.5;
/** Faster platforms would break the "nothing moves more than 32 u per tick without sub-stepping" rule. */
const MAX_PLATFORM_SPEED_UPS = 600;
const MAX_PLATFORM_WAIT_MS = 10_000;
const NOT_YET: Readonly<Record<string, string>> = {
  x: 'crumbling blocks (x) are not supported until their behavior is built',
  c: 'cracked walls (c) are not supported until their behavior is built',
};

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

class Errors {
  readonly list: string[] = [];

  add(message: string): void {
    if (this.list.length < MAX_ERRORS) this.list.push(message);
  }

  get any(): boolean {
    return this.list.length > 0;
  }
}

function checkKeys(raw: Raw, allowed: ReadonlySet<string>, where: string, errors: Errors): void {
  for (const key of Object.keys(raw)) if (!allowed.has(key)) errors.add(`${where}: unknown key "${key}"`);
}

/** Collider overlap with solid tiles, used to reject spawns and platforms placed inside walls. */
function rectHitsSolid(
  tiles: Uint8Array,
  w: number,
  h: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  const c0 = Math.floor(left / TILE);
  const c1 = Math.ceil(right / TILE) - 1;
  const r0 = Math.floor(top / TILE);
  const r1 = Math.ceil(bottom / TILE) - 1;
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (c < 0 || c >= w || r < 0) return true;
      if (r >= h) continue;
      if (((tiles[r * w + c] ?? 0) & TileFlag.Solid) !== 0) return true;
    }
  }
  return false;
}

function parseRows(raw: unknown, w: number, h: number, errors: Errors): Uint8Array | null {
  if (!Array.isArray(raw)) {
    errors.add('rows: must be an array of strings');
    return null;
  }
  if (raw.length !== h) errors.add(`rows: expected ${String(h)} rows, found ${String(raw.length)}`);
  const tiles = new Uint8Array(w * h);
  raw.slice(0, h).forEach((row: unknown, r) => {
    if (typeof row !== 'string') {
      errors.add(`rows[${String(r)}]: must be a string`);
      return;
    }
    if (row.length !== w)
      errors.add(`rows[${String(r)}]: expected ${String(w)} characters, found ${String(row.length)}`);
    for (let c = 0; c < Math.min(row.length, w); c += 1) {
      const ch = row.charAt(c);
      const flags = TILE_LEGEND[ch];
      if (flags === undefined) {
        errors.add(`rows[${String(r)}][${String(c)}]: ${NOT_YET[ch] ?? `unknown tile character "${ch}"`}`);
      } else {
        tiles[r * w + c] = flags;
      }
    }
  });
  return tiles;
}

const POINT_KEYS = new Set(['id', 'type', 'x', 'y']);
const PLATFORM_KEYS = new Set(['id', 'type', 'x', 'y', 'path', 'speedUps', 'waitMs', 'oneWay', 'w', 'h']);
const SHARD_LINE_KEYS = new Set(['id', 'type', 'x', 'y', 'count', 'spacing', 'dir']);
const ENEMY_KEYS = new Set(['id', 'type', 'x', 'y', 'archetype', 'patrol', 'facing']);

interface ObjectsOut {
  spawn: { x: number; y: number } | null;
  platforms: PlatformDef[];
  enemies: EnemySpawn[];
  shards: LevelPoint[];
  checkpoints: LevelPoint[];
  exits: LevelPoint[];
}

/** Bottom-anchored objects stand on the bottom edge of their cell, centered (DECISIONS). */
function feet(o: { x: number; y: number }): { x: number; y: number } {
  return { x: (o.x + 0.5) * TILE, y: (o.y + 1) * TILE };
}

/** Floating collectibles sit in the middle of their cell. */
function cellCenter(x: number, y: number): { x: number; y: number } {
  return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
}

function parseEnemy(
  o: Raw,
  id: string,
  where: string,
  level: { w: number; h: number },
  errors: Errors,
): EnemySpawn | null {
  checkKeys(o, ENEMY_KEYS, where, errors);
  const archetype = o['archetype'];
  if (typeof archetype !== 'string' || !(ENEMY_ARCHETYPES as readonly string[]).includes(archetype)) {
    errors.add(`${where}: enemy archetype "${String(archetype)}" is not supported yet`);
    return null;
  }
  const facing = o['facing'] === undefined ? 1 : o['facing'];
  if (facing !== 1 && facing !== -1) {
    errors.add(`${where}: facing must be 1 or -1`);
    return null;
  }
  let patrol: EnemySpawn['patrol'] = null;
  const raw = o['patrol'];
  if (raw !== undefined) {
    if (!Array.isArray(raw) || raw.length !== 2 || !isFiniteNumber(raw[0]) || !isFiniteNumber(raw[1])) {
      errors.add(`${where}: patrol must be [fromX, toX] in tiles`);
      return null;
    }
    const [a, b] = raw as [number, number];
    if (a >= b || a < 0 || b >= level.w) {
      errors.add(`${where}: patrol must satisfy 0 <= fromX < toX < level width`);
      return null;
    }
    patrol = { minX: (a + 0.5) * TILE, maxX: (b + 0.5) * TILE };
  }
  const p = feet({ x: o['x'] as number, y: o['y'] as number });
  return { id, archetype: archetype as EnemyArchetype, x: p.x, y: p.y, facing, patrol };
}

function parsePlatform(
  o: Raw,
  where: string,
  level: { w: number; h: number },
  errors: Errors,
): PlatformDef | null {
  checkKeys(o, PLATFORM_KEYS, where, errors);
  const wTiles = o['w'] === undefined ? DEFAULT_PLATFORM_W_TILES : o['w'];
  const hTiles = o['h'] === undefined ? DEFAULT_PLATFORM_H_TILES : o['h'];
  const path = o['path'];
  let ok = true;
  if (!isFiniteNumber(wTiles) || wTiles < 0.5 || wTiles > 16) {
    errors.add(`${where}: w must be 0.5–16 tiles`);
    ok = false;
  }
  if (!isFiniteNumber(hTiles) || hTiles < 0.25 || hTiles > 4) {
    errors.add(`${where}: h must be 0.25–4 tiles`);
    ok = false;
  }
  if (!isFiniteNumber(o['speedUps']) || o['speedUps'] <= 0 || o['speedUps'] > MAX_PLATFORM_SPEED_UPS) {
    errors.add(`${where}: speedUps must be above 0 and at most ${String(MAX_PLATFORM_SPEED_UPS)}`);
    ok = false;
  }
  if (!isFiniteNumber(o['waitMs']) || o['waitMs'] < 0 || o['waitMs'] > MAX_PLATFORM_WAIT_MS) {
    errors.add(`${where}: waitMs must be 0–${String(MAX_PLATFORM_WAIT_MS)}`);
    ok = false;
  }
  if (typeof o['oneWay'] !== 'boolean') {
    errors.add(`${where}: oneWay must be true or false`);
    ok = false;
  }
  if (!Array.isArray(path) || path.length < 2 || path.length > 16) {
    errors.add(`${where}: path must list 2–16 [x, y] points`);
    return null;
  }
  const points: { x: number; y: number }[] = [];
  path.forEach((p: unknown, i) => {
    if (!Array.isArray(p) || p.length !== 2 || !isFiniteNumber(p[0]) || !isFiniteNumber(p[1])) {
      errors.add(`${where}: path[${String(i)}] must be [x, y] in tiles`);
      ok = false;
      return;
    }
    const [px, py] = p as [number, number];
    if (px < 0 || py < 0 || px > level.w || py > level.h) {
      errors.add(`${where}: path[${String(i)}] is outside the level`);
      ok = false;
    }
    points.push({ x: px * TILE, y: py * TILE });
  });
  const first = path[0] as unknown;
  if (Array.isArray(first) && (first[0] !== o['x'] || first[1] !== o['y'])) {
    errors.add(`${where}: x and y must equal the first path point`);
    ok = false;
  }
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && a.x === b.x && a.y === b.y) {
      errors.add(`${where}: path points ${String(i - 1)} and ${String(i)} are identical`);
      ok = false;
    }
  }
  if (!ok || !isNonEmptyString(o['id'])) return null;
  return {
    id: o['id'],
    path: points,
    w: (wTiles as number) * TILE,
    h: (hTiles as number) * TILE,
    speedUps: o['speedUps'] as number,
    waitTicks: msToTicks(o['waitMs'] as number),
    oneWay: o['oneWay'] as boolean,
  };
}

function parseObjects(
  raw: unknown,
  level: { w: number; h: number },
  ids: Set<string>,
  errors: Errors,
): ObjectsOut {
  const out: ObjectsOut = { spawn: null, platforms: [], enemies: [], shards: [], checkpoints: [], exits: [] };
  if (!Array.isArray(raw)) {
    errors.add('objects: must be an array');
    return out;
  }
  let spawns = 0;
  raw.forEach((o: unknown, i) => {
    const where = `objects[${String(i)}]`;
    if (!isRecord(o)) {
      errors.add(`${where}: must be an object`);
      return;
    }
    const id = o['id'];
    if (!isNonEmptyString(id)) errors.add(`${where}: id must be a non-empty string`);
    else if (ids.has(id)) errors.add(`${where}: duplicate id "${id}"`);
    else ids.add(id);
    if (!isFiniteNumber(o['x']) || !isFiniteNumber(o['y'])) {
      errors.add(`${where}: x and y must be numbers (tiles)`);
      return;
    }
    if (o['x'] < 0 || o['y'] < 0 || o['x'] >= level.w || o['y'] >= level.h) {
      errors.add(`${where}: position is outside the level`);
      return;
    }
    if (o['requires'] !== undefined) {
      errors.add(`${where}: "requires" is not supported yet`);
      return;
    }
    const objectId = isNonEmptyString(id) ? id : `#${String(i)}`;
    const pos = { x: o['x'], y: o['y'] };
    switch (o['type']) {
      case 'player_spawn':
        checkKeys(o, POINT_KEYS, where, errors);
        spawns += 1;
        out.spawn = feet(pos);
        break;
      case 'checkpoint':
        checkKeys(o, POINT_KEYS, where, errors);
        if (out.checkpoints.length >= LEVEL_LIMITS.maxCheckpoints)
          errors.add(`${where}: too many checkpoints`);
        else out.checkpoints.push({ id: objectId, ...feet(pos) });
        break;
      case 'exit':
        checkKeys(o, POINT_KEYS, where, errors);
        out.exits.push({ id: objectId, ...feet(pos) });
        break;
      case 'shard':
        checkKeys(o, POINT_KEYS, where, errors);
        out.shards.push({ id: objectId, ...cellCenter(pos.x, pos.y) });
        break;
      case 'shard_line': {
        checkKeys(o, SHARD_LINE_KEYS, where, errors);
        const { count, spacing, dir } = o;
        if (
          !isInt(count, 1, 64) ||
          !isFiniteNumber(spacing) ||
          spacing <= 0 ||
          (dir !== 'h' && dir !== 'v')
        ) {
          errors.add(`${where}: shard_line needs count 1–64, spacing > 0 (tiles), and dir "h" or "v"`);
          break;
        }
        for (let k = 0; k < count; k += 1) {
          const sx = dir === 'h' ? pos.x + k * spacing : pos.x;
          const sy = dir === 'v' ? pos.y + k * spacing : pos.y;
          if (sx >= level.w || sy >= level.h) {
            errors.add(`${where}: shard ${String(k)} of the line is outside the level`);
            break;
          }
          out.shards.push({ id: `${objectId}.${String(k)}`, ...cellCenter(sx, sy) });
        }
        break;
      }
      case 'enemy': {
        if (out.enemies.length >= LEVEL_LIMITS.maxEnemies) {
          errors.add(`${where}: too many enemies`);
          break;
        }
        const enemy = parseEnemy(o, objectId, where, level, errors);
        if (enemy) out.enemies.push(enemy);
        break;
      }
      case 'moving_platform': {
        if (out.platforms.length >= LEVEL_LIMITS.maxPlatforms) {
          errors.add(`${where}: more than ${String(LEVEL_LIMITS.maxPlatforms)} moving platforms`);
          break;
        }
        const platform = parsePlatform(o, where, level, errors);
        if (platform) out.platforms.push(platform);
        break;
      }
      default:
        errors.add(`${where}: object type "${String(o['type'])}" is not supported yet`);
    }
  });
  if (spawns !== 1) errors.add(`objects: expected exactly one player_spawn, found ${String(spawns)}`);
  if (out.shards.length > LEVEL_LIMITS.maxShards)
    errors.add(`objects: more than ${String(LEVEL_LIMITS.maxShards)} shards`);
  return out;
}

const ZONE_KEYS = new Set(['id', 'type', 'x', 'y', 'w', 'h']);

function parseZones(
  raw: unknown,
  level: { w: number; h: number },
  ids: Set<string>,
  errors: Errors,
): LevelZone[] {
  const zones: LevelZone[] = [];
  if (!Array.isArray(raw)) {
    errors.add('zones: must be an array');
    return zones;
  }
  if (raw.length > LEVEL_LIMITS.maxZones)
    errors.add(`zones: more than ${String(LEVEL_LIMITS.maxZones)} zones`);
  raw.slice(0, LEVEL_LIMITS.maxZones).forEach((z: unknown, i) => {
    const where = `zones[${String(i)}]`;
    if (!isRecord(z)) {
      errors.add(`${where}: must be an object`);
      return;
    }
    checkKeys(z, ZONE_KEYS, where, errors);
    const id = z['id'];
    if (!isNonEmptyString(id)) {
      errors.add(`${where}: id must be a non-empty string`);
      return;
    }
    if (ids.has(id)) errors.add(`${where}: duplicate id "${id}"`);
    ids.add(id);
    const type = z['type'];
    if (typeof type !== 'string' || !(ZONE_TYPES as readonly string[]).includes(type)) {
      errors.add(`${where}: unknown zone type "${String(type)}"`);
      return;
    }
    const { x, y, w, h } = z;
    if (
      !isFiniteNumber(x) ||
      !isFiniteNumber(y) ||
      !isFiniteNumber(w) ||
      !isFiniteNumber(h) ||
      w <= 0 ||
      h <= 0
    ) {
      errors.add(`${where}: x, y, w, h must be numbers (tiles) with w and h above 0`);
      return;
    }
    if (x < 0 || y < 0 || x + w > level.w || y + h > level.h) {
      errors.add(`${where}: zone extends outside the level`);
      return;
    }
    zones.push({ id, type: type as ZoneType, x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE });
  });
  return zones;
}

/** Validates a level file's parsed JSON. Same input, same `Level` and hash, always. */
export function parseLevel(raw: unknown): LevelParseResult {
  const errors = new Errors();
  if (!isRecord(raw)) return { ok: false, errors: ['level: must be a JSON object'] };
  checkKeys(raw, TOP_LEVEL_KEYS, 'level', errors);

  if (raw['schemaVersion'] !== 1)
    errors.add(`schemaVersion: expected 1, found ${String(raw['schemaVersion'])}`);
  const id = raw['id'];
  if (typeof id !== 'string' || !ID_RE.test(id))
    errors.add('id: must match [a-z][a-z0-9_]* (at most 64 characters)');
  const planet = raw['planet'];
  if (!isPlanetId(planet)) errors.add(`planet: unknown planet "${String(planet)}"`);
  if (!isNonEmptyString(raw['nameKey'])) errors.add('nameKey: must be a non-empty string');
  if (!isNonEmptyString(raw['musicId'])) errors.add('musicId: must be a non-empty string');
  const par = raw['parTimeSec'];
  if (par !== undefined && (!isFiniteNumber(par) || par <= 0))
    errors.add('parTimeSec: must be a positive number');
  for (const key of ['decor', 'triggers'] as const) {
    const list = raw[key];
    if (!Array.isArray(list)) errors.add(`${key}: must be an array`);
    else if (list.length > 0) errors.add(`${key}: entries are not supported yet (Pass 2F); leave it empty`);
  }

  const size = raw['size'];
  if (
    !isRecord(size) ||
    !isInt(size['w'], 1, LEVEL_LIMITS.maxWidthTiles) ||
    !isInt(size['h'], 1, LEVEL_LIMITS.maxHeightTiles)
  ) {
    errors.add(
      `size: w must be 1–${String(LEVEL_LIMITS.maxWidthTiles)} and h 1–${String(LEVEL_LIMITS.maxHeightTiles)} whole tiles`,
    );
    return { ok: false, errors: errors.list };
  }
  checkKeys(size, new Set(['w', 'h']), 'size', errors);
  const w = size['w'];
  const h = size['h'];

  const tiles = parseRows(raw['rows'], w, h, errors);
  const ids = new Set<string>();
  const objects = parseObjects(raw['objects'], { w, h }, ids, errors);
  const zones = parseZones(raw['zones'], { w, h }, ids, errors);

  if (tiles && objects.spawn) {
    const { x, y } = objects.spawn;
    const half = P.colliderU.width / 2;
    if (rectHitsSolid(tiles, w, h, x - half, y - P.colliderU.height, x + half, y))
      errors.add('player_spawn: the player would start inside a wall');
  }
  if (tiles) {
    objects.platforms.forEach((p) => {
      const start = p.path[0];
      if (start && rectHitsSolid(tiles, w, h, start.x, start.y, start.x + p.w, start.y + p.h))
        errors.add(`moving_platform "${p.id}": starts inside a wall`);
    });
  }

  if (errors.any || !tiles || !objects.spawn) return { ok: false, errors: errors.list };
  const level: Level = {
    id: id as string,
    planet: planet as PlanetId,
    nameKey: raw['nameKey'] as string,
    musicId: raw['musicId'] as string,
    parTimeSec: isFiniteNumber(par) ? par : null,
    widthTiles: w,
    heightTiles: h,
    rows: (raw['rows'] as string[]).slice(),
    tiles,
    spawn: objects.spawn,
    platforms: objects.platforms,
    enemies: objects.enemies,
    shards: objects.shards,
    checkpoints: objects.checkpoints,
    exits: objects.exits,
    zones,
    hash: fnv1aHex(canonicalJson(raw)),
  };
  return { ok: true, level };
}
