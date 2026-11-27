import { describe, expect, it } from 'vitest';
import { GameConfig, Ticks } from '../../src/core/GameConfig';
import { createWorld, setupFor } from '../../src/core/WorldSimulation';
import { hudState } from '../../src/hud/HudModel';
import { flatLevel } from '../fixtures/levels';

function world() {
  const level = flatLevel();
  return createWorld(setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 1 }), level);
}

describe('HUD model (spec 8.7)', () => {
  it('a fresh player shows full bars and no shards', () => {
    const w = world();
    expect(hudState(w.players[0], w.run)).toEqual({
      hpPct: 100,
      shieldPct: 100,
      fuelPct: 100,
      shards: 0,
      lowHp: false,
      heatPct: 0,
      venting: false,
      dashCooldownPct: 0,
    });
  });

  it('reports whole percentages, low HP below 25%, heat, vent, and dash cooldown', () => {
    const w = world();
    const p = w.players[0];
    if (!p) throw new Error('no player');
    p.hp = 24;
    p.shield = GameConfig.health.baseShield / 2;
    p.fuelS = GameConfig.player.jetpack.baseFuelS / 3;
    p.heat = 50;
    p.ventTicks = 10;
    p.dashCooldownTicks = Ticks.dashCooldown;
    w.run.shardsBanked = 3;
    w.run.shardsCarried = 2;
    expect(hudState(p, w.run)).toEqual({
      hpPct: 24,
      shieldPct: 50,
      fuelPct: 33,
      shards: 5,
      lowHp: true,
      heatPct: 50,
      venting: true,
      dashCooldownPct: 100,
    });
  });

  it('a dead player is not "low HP"; a missing player shows empty bars', () => {
    const w = world();
    const p = w.players[0];
    if (!p) throw new Error('no player');
    p.hp = 0;
    expect(hudState(p, w.run).lowHp).toBe(false);
    expect(hudState(undefined, w.run).hpPct).toBe(0);
  });
});
