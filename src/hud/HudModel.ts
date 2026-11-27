import { GameConfig, Ticks } from '../core/GameConfig';
import type { PlayerState, RunState } from '../core/SimulationTypes';
import { isLowHp } from '../render/fx/FxMath';

/**
 * What the HUD shows (spec 8.7), as whole percentages, so the DOM is written only when a value
 * actually changes (spec 13.7 step 6).
 */
export interface HudState {
  readonly hpPct: number;
  readonly shieldPct: number;
  readonly fuelPct: number;
  /** Shards collected this run: banked plus carried. */
  readonly shards: number;
  readonly lowHp: boolean;
  /** Pulse Blaster heat, for the ring on Shoot. */
  readonly heatPct: number;
  readonly venting: boolean;
  /** Remaining dash cooldown, for the ring on Dash (0 when ready). */
  readonly dashCooldownPct: number;
}

function pct(value: number, max: number): number {
  if (max <= 0 || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value / max)) * 100);
}

export function hudState(player: PlayerState | undefined, run: RunState): HudState {
  const H = GameConfig.health;
  const shards = run.shardsBanked + run.shardsCarried;
  if (!player) {
    return {
      hpPct: 0,
      shieldPct: 0,
      fuelPct: 0,
      shards,
      lowHp: false,
      heatPct: 0,
      venting: false,
      dashCooldownPct: 0,
    };
  }
  return {
    hpPct: pct(player.hp, H.baseHp),
    shieldPct: pct(player.shield, H.baseShield),
    fuelPct: pct(player.fuelS, GameConfig.player.jetpack.baseFuelS),
    shards,
    lowHp: isLowHp(player.hp, H.baseHp),
    heatPct: pct(player.heat, GameConfig.combat.heat.max),
    venting: player.ventTicks > 0,
    dashCooldownPct: pct(player.dashCooldownTicks, Ticks.dashCooldown),
  };
}
