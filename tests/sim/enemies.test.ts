import { describe, expect, it } from 'vitest';
import { telegraphTicks } from '../../src/core/enemies/EnemyCommon';
import { DT, GameConfig, Ticks } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import type { EnemyState } from '../../src/core/SimulationTypes';
import { Harness, input, makeLevel } from '../fixtures/levels';

const C = GameConfig.enemies.crawler;
const TILE = GameConfig.world.tileSizeU;

/** Floor top y = 640; walls at both ends; a 3-tile pit at columns 20–22. */
const ARENA_ROWS = [
  '##############################',
  ...Array.from({ length: 9 }, () => '#............................#'),
  '####################...#######',
  '##############################',
];

function crawlerLevel(
  crawler: Record<string, unknown>,
  options: { spawn?: [number, number]; difficulty?: never } = {},
): ReturnType<typeof makeLevel> {
  return makeLevel(ARENA_ROWS, {
    spawn: options.spawn ?? [1, 9],
    objects: [{ id: 'c', type: 'enemy', archetype: 'crawler', ...crawler }],
  });
}

function crawler(h: Harness): EnemyState {
  const e = h.world.enemies[0];
  if (!e) throw new Error('no crawler');
  return e;
}

describe('Crawler (spec 4.4)', () => {
  it('patrols at 120 u/s inside its bounds, turning at the bounds', () => {
    const h = new Harness(crawlerLevel({ x: 12, y: 9, patrol: [10, 14] }, { spawn: [26, 9] }));
    // The player stands far right, beyond engage range of the whole patrol: the crawler only patrols.
    h.player.x = 28.5 * TILE;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 600; i += 1) {
      h.step();
      const e = crawler(h);
      if (e.mode === 'patrol') {
        minX = Math.min(minX, e.x);
        maxX = Math.max(maxX, e.x);
        if (e.vx !== 0) expect(Math.abs(e.vx)).toBe(C.patrolUps);
      }
    }
    expect(minX).toBeGreaterThanOrEqual(10.5 * TILE - C.patrolUps * DT);
    expect(maxX).toBeLessThanOrEqual(14.5 * TILE + C.patrolUps * DT);
    expect(maxX - minX).toBeGreaterThan(3 * TILE);
  });

  it('turns at ledges instead of walking off, and at walls', () => {
    const h = new Harness(crawlerLevel({ x: 17, y: 9, facing: 1 }, { spawn: [1, 9] }));
    const e = crawler(h);
    e.asleep = false;
    h.until(() => e.facing === -1, input(), 200);
    expect(e.grounded).toBe(true);
    expect(e.x + C.colliderU.width / 2).toBeLessThanOrEqual(20 * TILE + 4); // stopped at the pit edge
    expect(e.mode).toBe('patrol');

    const walled = new Harness(crawlerLevel({ x: 26, y: 9, facing: 1 }, { spawn: [24, 9] }));
    const w = crawler(walled);
    walled.player.x = 21 * TILE; // across the pit, so it never engages before reaching the wall
    walled.player.mode = 'dead';
    w.asleep = false;
    walled.until(() => w.facing === -1, input(), 200);
    expect(w.x + C.colliderU.width / 2).toBeLessThanOrEqual(29 * TILE + 2);
  });

  it('sleeps beyond 1400 u and wakes within it; sleeps again beyond 2200 u', () => {
    const wide = makeLevel(
      [
        '#'.repeat(60),
        ...Array.from({ length: 9 }, () => `#${'.'.repeat(58)}#`),
        '#'.repeat(60),
        '#'.repeat(60),
      ],
      { spawn: [1, 9], objects: [{ id: 'c', type: 'enemy', archetype: 'crawler', x: 40, y: 9 }] },
    );
    const h = new Harness(wide);
    h.step();
    const e = crawler(h);
    expect(e.asleep).toBe(true);
    const x0 = e.x;
    h.run(30);
    expect(e.x).toBe(x0);
    h.placePlayer(e.x - 1300, 10 * TILE);
    h.step();
    expect(e.asleep).toBe(false);
    h.placePlayer(1.5 * TILE, 10 * TILE);
    h.step();
    expect(Math.abs(h.player.x - e.x)).toBeGreaterThan(2200);
    expect(e.asleep).toBe(true);
  });

  it('alert (0.4 s), then a 0.35 s crouch telegraph, then a 260 u/s charge', () => {
    const h = new Harness(crawlerLevel({ x: 10, y: 9, facing: -1 }, { spawn: [4, 9] }));
    const e = crawler(h);
    h.until(() => e.mode === 'alert', input(), 60);
    const alertTick = h.world.tick;
    h.until(() => e.mode === 'windup', input(), 120);
    expect(h.world.tick - alertTick).toBeGreaterThanOrEqual(Ticks.enemyAlert);
    const windupTick = h.world.tick;
    h.until(() => e.mode === 'attack', input(), 60);
    expect(h.world.tick - windupTick).toBe(Ticks.crawlerWindup);
    h.step();
    expect(e.vx).toBe(-C.chargeUps);
    expect(h.eventsOf('enemyAlert')).toHaveLength(1);
    expect(h.eventsOf('enemyWindup')).toHaveLength(1);
  });

  it('the charge deals 15 contact damage (shield first) with knockback, once per invulnerability window', () => {
    const h = new Harness(crawlerLevel({ x: 10, y: 9, facing: -1 }, { spawn: [4, 9] }));
    h.until((s) => s.eventsOf('playerHurt').length > 0, input(), 240);
    const hurt = h.eventsOf('playerHurt')[0];
    expect(hurt?.type === 'playerHurt' && hurt.damage).toBe(C.contactDamage);
    expect(h.player.shield).toBe(GameConfig.health.baseShield - C.contactDamage);
    expect(h.player.hp).toBe(GameConfig.health.baseHp);
    expect(h.player.vx).toBe(-GameConfig.combat.knockback.vxUps);
    expect(h.player.vy).toBe(GameConfig.combat.knockback.vyUps);
    h.run(30);
    expect(h.eventsOf('playerHurt')).toHaveLength(1);
  });

  it('jumping over the charge avoids it', () => {
    const h = new Harness(crawlerLevel({ x: 10, y: 9, facing: -1 }, { spawn: [4, 9] }));
    const e = crawler(h);
    // Jump when the charge is 140 u away, and hold Jump (full jump, then the jetpack hovers).
    h.until(() => e.mode === 'attack' && e.x - h.player.x < 140, input(), 300);
    h.step(input({ held: Button.Jump }));
    h.until(() => e.mode !== 'attack', input({ held: Button.Jump }), 240);
    expect(h.eventsOf('playerHurt')).toHaveLength(0);
    expect(e.x).toBeLessThan(h.player.x); // it went underneath
  });

  it('30 HP: three blaster hits defeat it and it drops 3 shards that land and can be collected', () => {
    const h = new Harness(crawlerLevel({ x: 9, y: 9, facing: 1, patrol: [8, 10] }, { spawn: [3, 9] }));
    const e = crawler(h);
    e.asleep = false;
    h.until((s) => s.eventsOf('enemyDefeated').length > 0, input({ held: Button.Shoot }), 300);
    expect(h.eventsOf('enemyHurt')).toHaveLength(3);
    expect(h.world.enemies).toHaveLength(0);
    expect(h.world.pickups).toHaveLength(C.shards);
    h.run(60);
    for (const shard of h.world.pickups) expect(shard.floating).toBe(true);
    h.until((s) => s.world.pickups.length === 0, input({ moveX: 1 }), 300);
    expect(h.world.run.shardsCarried).toBe(C.shards);
  });

  it('difficulty scales HP, damage taken, and telegraphs (never below 300 ms)', () => {
    const level = crawlerLevel({ x: 10, y: 9 });
    const easy = new Harness(level, 1, 1, 'easy');
    const hard = new Harness(level, 1, 1, 'hard');
    expect(crawler(easy).hp).toBe(24);
    expect(crawler(hard).hp).toBe(35);
    expect(telegraphTicks(Ticks.crawlerWindup, 'normal')).toBe(21);
    expect(telegraphTicks(Ticks.crawlerWindup, 'hard')).toBe(19);
    expect(telegraphTicks(Ticks.crawlerWindup, 'drift_plus')).toBe(18);
    easy.until((s) => s.eventsOf('playerHurt').length > 0, input(), 300);
    const hit = easy.eventsOf('playerHurt')[0];
    expect(hit?.type === 'playerHurt' && hit.damage).toBe(8);
  });
});
