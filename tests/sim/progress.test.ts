import { describe, expect, it } from 'vitest';
import { GameConfig, Ticks } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import { parseLevel } from '../../src/core/level/AsciiParser';
import { ShardStatus } from '../../src/core/SimulationTypes';
import { Harness, input, makeLevel, rawLevel } from '../fixtures/levels';

const TILE = GameConfig.world.tileSizeU;
const PK = GameConfig.pickups;

/** Floor top y = 640, 40 tiles wide; spikes at column 30 for deaths on demand. */
const ROWS = [
  '#'.repeat(40),
  ...Array.from({ length: 9 }, () => `#${'.'.repeat(38)}#`),
  `${'#'.repeat(30)}^${'#'.repeat(9)}`,
  '#'.repeat(40),
];

function progressLevel(objects: Record<string, unknown>[], extra: Parameters<typeof makeLevel>[1] = {}) {
  return makeLevel(ROWS, { spawn: [2, 9], objects, ...extra });
}

const RIGHT = input({ moveX: 1 });

describe('shards (spec 3.5, M5)', () => {
  it('a shard inside the magnet radius flies in; inside the pickup radius it is collected', () => {
    const h = new Harness(progressLevel([{ id: 's', type: 'shard', x: 4, y: 9 }]));
    const shard = h.world.pickups[0];
    if (!shard) throw new Error('no shard');
    const center = (): { x: number; y: number } => ({ x: h.player.x, y: h.player.y - 44 });
    const dist = (): number => Math.hypot(shard.x - center().x, shard.y - center().y);
    expect(dist()).toBeGreaterThan(PK.magnetRadiusU);
    h.until(() => dist() <= PK.magnetRadiusU, RIGHT, 60);
    h.step();
    expect(h.world.run.shardsCarried + h.world.pickups.length).toBe(1);
    h.until((s) => s.world.pickups.length === 0, input(), 30);
    expect(h.world.run.shardsCarried).toBe(1);
    expect(h.world.run.shardStatus).toEqual([ShardStatus.Carried]);
    expect(h.eventsOf('shardCollected')).toHaveLength(1);
  });

  it('shard lines expand along x or y at the given spacing', () => {
    const parsed = parseLevel(
      rawLevel(ROWS, {
        spawn: [2, 9],
        objects: [
          { id: 'h', type: 'shard_line', x: 5, y: 3, count: 4, spacing: 2, dir: 'h' },
          { id: 'v', type: 'shard_line', x: 20, y: 2, count: 3, spacing: 1.5, dir: 'v' },
        ],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));
    expect(parsed.level.shards.map((s) => s.x / TILE - 0.5)).toEqual([5, 7, 9, 11, 20, 20, 20]);
    expect(parsed.level.shards.slice(4).map((s) => s.y / TILE - 0.5)).toEqual([2, 3.5, 5]);
  });
});

describe('checkpoints, death, and the exit (spec 4.3)', () => {
  const objects = [
    { id: 's1', type: 'shard', x: 6, y: 9 },
    { id: 's2', type: 'shard', x: 14, y: 9 },
    { id: 'cp', type: 'checkpoint', x: 10, y: 9 },
    { id: 'crawler', type: 'enemy', archetype: 'crawler', x: 24, y: 9, patrol: [22, 26] },
    { id: 'exit', type: 'exit', x: 36, y: 9 },
  ];

  it('a checkpoint banks carried shards, restores health, and becomes the respawn point', () => {
    const h = new Harness(progressLevel(objects));
    h.player.hp = 40;
    h.player.shield = 0;
    h.until((s) => s.eventsOf('checkpointReached').length > 0, RIGHT, 200);
    const run = h.world.run;
    expect(run.shardsBanked).toBe(1);
    expect(run.shardsCarried).toBe(0);
    expect(run.shardStatus[0]).toBe(ShardStatus.Banked);
    expect(h.player.hp).toBe(GameConfig.health.baseHp);
    expect(h.player.shield).toBe(GameConfig.health.baseShield);
    expect(run.respawnX).toBe(10.5 * TILE);
    expect(run.respawnY).toBe(10 * TILE);
  });

  it('death: carried shards are lost and return, enemies reset, the player respawns at the checkpoint', () => {
    const h = new Harness(progressLevel(objects));
    h.until((s) => s.eventsOf('checkpointReached').length > 0, RIGHT, 200);
    h.until((s) => s.world.run.shardsCarried === 1, RIGHT, 200); // the shard after the checkpoint
    // Shoot the crawler dead, then die on purpose.
    const crawlerId = h.world.enemies[0]?.id;
    for (const e of h.world.enemies) e.asleep = false;
    h.until((s) => s.world.enemies.length === 0, input({ held: Button.Shoot }), 400);
    h.player.hp = 1;
    h.player.shield = 0;
    h.player.invulnTicks = 0;
    h.placePlayer(30.5 * TILE, 10 * TILE + 20); // into the spikes
    h.until((s) => s.player.mode === 'dead', input(), 10);
    h.run(Ticks.deathSequence);
    expect(h.player.mode).toBe('ground');
    expect(h.player.x).toBe(10.5 * TILE);
    const run = h.world.run;
    expect(run.shardsCarried).toBe(0);
    expect(run.shardsBanked).toBe(1);
    expect(run.shardStatus).toEqual([ShardStatus.Banked, ShardStatus.Present]);
    expect(h.world.pickups.map((p) => p.source)).toEqual([1]); // s2 is back; the drops are gone
    expect(h.world.enemies).toHaveLength(1);
    expect(h.world.enemies[0]?.id).not.toBe(crawlerId); // a fresh enemy, not the old one revived
    expect(h.world.projectiles).toHaveLength(0);
  });

  it('only the enemies of the respawn section reset when the level has sections', () => {
    const sectioned = progressLevel(
      [
        { id: 'cp', type: 'checkpoint', x: 4, y: 9 },
        { id: 'near', type: 'enemy', archetype: 'crawler', x: 8, y: 9, patrol: [7, 9] },
        { id: 'far', type: 'enemy', archetype: 'crawler', x: 34, y: 9, patrol: [33, 35] },
      ],
      {
        zones: [
          { id: 'a', type: 'section', x: 0, y: 0, w: 20, h: 12 },
          { id: 'b', type: 'section', x: 20, y: 0, w: 20, h: 12 },
        ],
      },
    );
    const h = new Harness(sectioned);
    h.until((s) => s.eventsOf('checkpointReached').length > 0, RIGHT, 100);
    const far = h.world.enemies.find((e) => e.spawnIndex === 1);
    const near = h.world.enemies.find((e) => e.spawnIndex === 0);
    if (!far || !near) throw new Error('missing enemies');
    far.hp = 7; // damaged earlier
    h.player.hp = 1;
    h.player.shield = 0;
    h.player.invulnTicks = 0;
    h.placePlayer(30.5 * TILE, 10 * TILE + 20);
    h.until((s) => s.player.mode === 'dead', input(), 10);
    h.run(Ticks.deathSequence);
    expect(h.world.enemies.find((e) => e.spawnIndex === 1)?.hp).toBe(7);
    expect(h.world.enemies.find((e) => e.spawnIndex === 0)?.id).not.toBe(near.id);
  });

  it('the exit completes the level once and banks carried shards', () => {
    const h = new Harness(
      progressLevel([
        { id: 's', type: 'shard', x: 33, y: 9 },
        { id: 'exit', type: 'exit', x: 36, y: 9 },
      ]),
    );
    h.placePlayer(31 * TILE, 10 * TILE);
    h.until((s) => s.eventsOf('levelComplete').length > 0, RIGHT, 200);
    expect(h.world.run.completeTick).toBeGreaterThan(0);
    expect(h.world.run.shardsBanked).toBe(1);
    h.run(30, RIGHT);
    expect(h.eventsOf('levelComplete')).toHaveLength(1);
  });

  it('the parser places checkpoints and exits on the floor of their cell and rejects unknown enemy fields', () => {
    const ok = parseLevel(
      rawLevel(ROWS, { spawn: [2, 9], objects: [{ id: 'cp', type: 'checkpoint', x: 10, y: 9 }] }),
    );
    if (!ok.ok) throw new Error(ok.errors.join('; '));
    expect(ok.level.checkpoints[0]).toEqual({ id: 'cp', x: 10.5 * TILE, y: 10 * TILE });
    const elite = parseLevel(
      rawLevel(ROWS, {
        spawn: [2, 9],
        objects: [{ id: 'e', type: 'enemy', archetype: 'crawler', x: 10, y: 9, elite: 'swift' }],
      }),
    );
    expect(elite.ok).toBe(false);
    const requires = parseLevel(
      rawLevel(ROWS, {
        spawn: [2, 9],
        objects: [{ id: 's', type: 'shard', x: 10, y: 9, requires: ['grapple'] }],
      }),
    );
    expect(requires.ok ? '' : requires.errors.join()).toMatch(/requires/);
  });
});
