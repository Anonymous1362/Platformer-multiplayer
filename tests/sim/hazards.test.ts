import { describe, expect, it } from 'vitest';
import { GameConfig, Ticks } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import type { HazardCause, SimulationEvent } from '../../src/core/SimulationTypes';
import { Harness, input, makeLevel } from '../fixtures/levels';

const H = GameConfig.health;
const TILE = GameConfig.world.tileSizeU;

/** Floor top y = 576; spikes fill columns 8–10 of the floor row; a lava strip at columns 14–15. */
const PIT_ROOM = makeLevel(
  [
    '####################',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '########^^^###~~####',
    '####################',
  ],
  { spawn: [2, 8] },
);

function causeOf(events: readonly SimulationEvent[]): HazardCause | null {
  for (const e of events) if (e.type === 'hazardHit') return e.cause;
  return null;
}

describe('hazards and respawn (spec section 4.3)', () => {
  it('spikes: 25 damage to the shield first, then a 0.5 s fade back to safe ground', () => {
    const h = new Harness(PIT_ROOM);
    h.run(120); // stand on safe ground long enough to bank a respawn point
    let hitTick = -1;
    h.until((s) => s.player.mode === 'hazardRespawn', input({ moveX: 1 }));
    hitTick = h.world.tick - 1;
    expect(causeOf(h.events)).toBe('spikes');
    expect(h.player.shield).toBe(H.baseShield - GameConfig.hazard.damage);
    expect(h.player.hp).toBe(H.baseHp);

    // Frozen while fading out, moved at the midpoint, control back at the end.
    const half = Math.ceil(Ticks.hazardRespawn / 2);
    h.run(half - 1);
    expect(h.player.vx).toBe(0);
    h.step();
    const respawnX = h.player.x;
    expect(h.player.y).toBe(9 * TILE);
    h.run(Ticks.hazardRespawn - half);
    expect(h.player.mode).toBe('ground');
    const respawned = h.eventsOf('respawned');
    expect(respawned[0]?.tick).toBe(hitTick + Ticks.hazardRespawn);

    // Safe ground is at least two tiles from any hazard (spikes start at x = 512).
    expect(respawnX + GameConfig.player.hurtboxU.width / 2 + 2 * TILE).toBeLessThanOrEqual(8 * TILE);
  });

  it('the respawn point is at least 1 s old, never the last step before the hazard', () => {
    const h = new Harness(PIT_ROOM);
    h.run(200);
    const xs: { tick: number; x: number }[] = [];
    h.until(
      (s) => {
        xs.push({ tick: s.world.tick, x: s.player.x });
        return s.player.mode === 'hazardRespawn';
      },
      input({ moveX: 0.3 }),
      400,
    );
    const hitTick = h.world.tick;
    h.until((s) => s.player.mode === 'ground', input());
    const visited = xs.find((v) => v.x === h.player.x);
    expect(visited).toBeDefined();
    expect(hitTick - (visited?.tick ?? hitTick)).toBeGreaterThanOrEqual(Ticks.safeGroundMinAge);
  });

  it('invulnerability blocks damage but never the respawn (no hazard loops)', () => {
    const h = new Harness(PIT_ROOM);
    h.run(120);
    h.until((s) => s.player.mode === 'hazardRespawn', input({ moveX: 1 }));
    h.until((s) => s.player.mode === 'ground', input());
    const shieldAfterFirst = h.player.shield;
    expect(h.player.invulnTicks).toBeGreaterThan(0);
    // Straight back into the spikes while still invulnerable.
    h.placePlayer(9.5 * TILE, 9 * TILE + 10);
    h.step();
    expect(h.player.mode).toBe('hazardRespawn');
    expect(h.eventsOf('hazardHit')).toHaveLength(2);
    const second = h.eventsOf('hazardHit')[1];
    expect(second?.type === 'hazardHit' && second.damage).toBe(0);
    expect(h.player.shield).toBeGreaterThanOrEqual(shieldAfterFirst);
  });

  it('lava is a hazard too', () => {
    const h = new Harness(PIT_ROOM);
    h.placePlayer(14.5 * TILE, 8 * TILE);
    h.until((s) => s.player.mode === 'hazardRespawn', input());
    expect(causeOf(h.events)).toBe('lava');
  });

  it('falling out of the level is a pit; kill-plane zones count as pits', () => {
    const open = makeLevel(['##########', '#........#', '#........#', '####..####'], { spawn: [1, 2] });
    const a = new Harness(open);
    a.placePlayer(4.5 * TILE, 3 * TILE - 2);
    a.until((s) => s.player.mode === 'hazardRespawn', input());
    expect(causeOf(a.events)).toBe('pit');

    const zoned = makeLevel(['##########', '#........#', '#........#', '####..####', '##########'], {
      spawn: [1, 2],
      zones: [{ id: 'kp', type: 'kill_plane', x: 4, y: 3.5, w: 2, h: 0.5 }],
    });
    const b = new Harness(zoned);
    b.placePlayer(4.5 * TILE, 3 * TILE - 2);
    b.until((s) => s.player.mode === 'hazardRespawn', input());
    expect(causeOf(b.events)).toBe('pit');
  });

  it('no_safe_ground zones are never used as respawn points', () => {
    const level = makeLevel(PIT_ROOM.rows, {
      spawn: [2, 8],
      zones: [{ id: 'nsg', type: 'no_safe_ground', x: 1, y: 7, w: 5, h: 2 }],
    });
    const h = new Harness(level);
    h.placePlayer(4 * TILE, 9 * TILE); // inside the zone, otherwise perfectly safe ground
    h.run(150);
    h.placePlayer(9.5 * TILE, 9 * TILE + 10);
    h.until((s) => s.player.mode === 'hazardRespawn', input());
    h.until((s) => s.player.mode === 'ground', input());
    expect(h.player.x).toBe(level.spawn.x); // the zone samples were rejected; the spawn is the fallback
  });

  it('at 0 HP: a 1.2 s death sequence, then a full restore at the spawn', () => {
    const h = new Harness(PIT_ROOM);
    h.player.hp = 10;
    h.player.shield = 0;
    h.until((s) => s.player.mode === 'dead', input({ moveX: 1 }));
    expect(h.eventsOf('died')).toHaveLength(1);
    h.run(Ticks.deathSequence - 1);
    expect(h.player.mode).toBe('dead');
    h.step();
    expect(h.player.mode).toBe('ground');
    expect(h.player.hp).toBe(H.baseHp);
    expect(h.player.shield).toBe(H.baseShield);
    expect(h.player.x).toBe(h.level.spawn.x);
  });

  it('the shield recharges 20/s starting 3 s after the last hit', () => {
    const h = new Harness(PIT_ROOM);
    h.run(120);
    h.until((s) => s.player.mode === 'hazardRespawn', input({ moveX: 1 }));
    const shield = h.player.shield;
    h.run(Ticks.shieldDelay - 2);
    expect(h.player.shield).toBe(shield);
    h.run(61); // the first 60 recharge ticks
    expect(h.player.shield).toBeCloseTo(shield + H.shieldRegenPerS, 6);
  });

  it('dash i-frames block hazard damage (the respawn still happens)', () => {
    const level = makeLevel(['##########', '#........#', '#.....^..#', '##########'], { spawn: [1, 2] });
    const dashed = new Harness(level);
    dashed.standAt(300, 3 * TILE);
    dashed.step(input({ moveX: 1, held: Button.Dash }));
    dashed.until((s) => s.player.mode === 'hazardRespawn', input(), 20);
    const hit = dashed.eventsOf('hazardHit')[0];
    expect(hit?.type === 'hazardHit' && hit.damage).toBe(0);
    expect(dashed.player.shield).toBe(H.baseShield);

    const walked = new Harness(level);
    walked.standAt(300, 3 * TILE);
    walked.until((s) => s.player.mode === 'hazardRespawn', input({ moveX: 1 }), 60);
    const walkHit = walked.eventsOf('hazardHit')[0];
    expect(walkHit?.type === 'hazardHit' && walkHit.damage).toBe(GameConfig.hazard.damage);
  });
});
