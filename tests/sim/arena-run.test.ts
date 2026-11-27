import { describe, expect, it } from 'vitest';
import { Button, type InputFrame } from '../../src/core/InputTypes';
import type { DifficultyId } from '../../src/core/Ids';
import { loadLevelById } from '../../tools/shared/levels';
import { Harness, input } from '../fixtures/levels';

/**
 * Pass 1E acceptance, "the arena plays start to finish": a closed-loop autopilot plays
 * `test_arena` with ordinary inputs (move, jump, dash, aimed shots) and must reach the exit. It reads
 * the state the way a player reads the screen and decides by position, so a death or a hazard respawn
 * just resumes from wherever the player is put back.
 */

const T = 64;
const FLOOR_Y = 20 * T; // floor top in the lower areas
const LEDGE_Y = 6 * T; // top of the wall-jump shaft and the checkpoint ledge
const SHAFT = { left: 23 * T, right: 26 * T };
const LAVA_EDGE = 36 * T;
const SHORE = { left: 48 * T, right: 50 * T };
const GAP_END = 54 * T;
const BLOCK_X = 60 * T;

interface Pilot {
  /** Ticks left to keep Jump held for the current jump; 0 = released. */
  jumpHold: number;
  /** Jump must be released for a tick before the next press. */
  jumpReleased: boolean;
  dashUsed: boolean;
}

function newPilot(): Pilot {
  return { jumpHold: 0, jumpReleased: true, dashUsed: false };
}

/** Aimed shots at the nearest awake Crawler in range (manual aim keeps facing free). */
function aimAtEnemy(h: Harness): { held: number; aimMrad: number } {
  const p = h.player;
  let best: { dx: number; dy: number; d: number } | null = null;
  for (const e of h.world.enemies) {
    if (e.asleep) continue;
    const dx = e.x - p.x;
    const dy = e.y - 20 - (p.y - 44);
    const d = Math.hypot(dx, dy);
    if (Math.abs(dy) < 160 && d < 700 && (!best || d < best.d)) best = { dx, dy, d };
  }
  if (!best) return { held: 0, aimMrad: 0 };
  return { held: Button.Shoot | Button.AimManual, aimMrad: Math.round(Math.atan2(best.dy, best.dx) * 1000) };
}

function decide(h: Harness, pilot: Pilot): InputFrame {
  const p = h.player;
  const plat = h.world.platforms[0];
  const platW = h.level.platforms[0]?.w ?? 192;
  let moveX = 0;
  let wantJump = false;
  let holdTicks = 16;
  let dash = false;

  const onPlatform = p.grounded && p.groundPlatform === 0;
  if (p.y <= LEDGE_Y + 2 && p.x >= SHAFT.left) {
    // On or above the ledge: walk right past the checkpoint and drop off the far end.
    moveX = 1;
  } else if (p.x >= SHAFT.left && p.x < SHAFT.right && p.y > LEDGE_Y) {
    // Wall-jump shaft: bounce between the walls; above the walls, steer onto the ledge.
    if (p.mode === 'wallSlide') {
      moveX = -p.wallSide;
      wantJump = true;
      holdTicks = 14;
    } else if (p.grounded) {
      moveX = 1;
      wantJump = true;
    } else {
      moveX = p.y < LEDGE_Y + 40 ? 1 : p.vx >= 0 ? 1 : -1;
    }
  } else if (p.x < SHAFT.left) {
    // Start area: run right; jump the spike pit.
    moveX = 1;
    if (p.grounded && p.x > 13 * T - 70 && p.x < 13 * T) wantJump = true;
  } else if (onPlatform || (plat && !p.grounded && p.x > LAVA_EDGE && p.x < SHORE.left)) {
    // Riding the lava lift: stay centered, jump for the shore at the far end, brake in the air.
    const center = (plat?.x ?? 0) + platW / 2;
    if (onPlatform) {
      moveX = Math.abs(center - p.x) > 12 ? Math.sign(center - p.x) : 0;
      if ((plat?.x ?? 0) >= 44 * T - 2) {
        moveX = 1;
        wantJump = true;
        holdTicks = 12;
      }
    } else {
      moveX = p.x < SHORE.left + 40 ? 1 : 0;
    }
  } else if (p.x < LAVA_EDGE) {
    // Lava shore: wait at the edge for the lift to reach its near end, then hop on.
    const standX = LAVA_EDGE - 28;
    moveX = Math.abs(standX - p.x) > 8 ? Math.sign(standX - p.x) : 0;
    if (p.grounded && plat && plat.x <= LAVA_EDGE + 6 && Math.abs(standX - p.x) < 24) {
      moveX = 1;
      wantJump = true;
      holdTicks = 10;
    }
    if (!p.grounded && plat && p.x > plat.x + 30) moveX = 0;
  } else if (p.x < GAP_END) {
    // Far shore and the bottomless gap: touch the checkpoint, then jump and dash across.
    moveX = 1;
    if (p.grounded) pilot.dashUsed = false;
    if (p.grounded && p.x > SHORE.right - 40) {
      wantJump = true;
      holdTicks = 30;
    }
    if (!p.grounded && p.vy > 0 && p.x < GAP_END && !pilot.dashUsed) {
      dash = true;
      pilot.dashUsed = true;
    }
  } else {
    // Ice strip: clear the Crawler, hop onto the block, and walk into the exit.
    moveX = 1;
    if (p.grounded && p.x > BLOCK_X - 110 && p.x < BLOCK_X && p.y > FLOOR_Y - 8) wantJump = true;
  }

  // Jump presses need a released tick in between; holds give the full arc.
  let held = 0;
  if (pilot.jumpHold > 0) {
    held |= Button.Jump;
    pilot.jumpHold -= 1;
    if (pilot.jumpHold === 0) pilot.jumpReleased = false;
  } else if (!pilot.jumpReleased) {
    pilot.jumpReleased = true;
  } else if (wantJump) {
    held |= Button.Jump;
    pilot.jumpHold = holdTicks;
  }
  if (dash) held |= Button.Dash;
  const shot = aimAtEnemy(h);
  return input({ moveX, held: held | shot.held, aimMrad: shot.aimMrad });
}

function runArena(difficulty: DifficultyId): { h: Harness; ticks: number } {
  const h = new Harness(loadLevelById('test_arena'), 1, 1, difficulty);
  const pilot = newPilot();
  const ticks = h.until(
    (s) => s.world.run.completeTick >= 0,
    (s) => decide(s, pilot),
    60 * 120,
  );
  return { h, ticks };
}

describe('test arena, start to finish (Pass 1E acceptance)', () => {
  it('an autopilot reaches the exit on Normal: both checkpoints, Crawlers cleared, shards banked', () => {
    const { h, ticks } = runArena('normal');
    expect(h.eventsOf('levelComplete')).toHaveLength(1);
    expect(h.world.run.checkpointsReached).toEqual([1, 1]);
    expect(h.eventsOf('enemyDefeated').length).toBeGreaterThanOrEqual(2);
    expect(h.world.run.shardsBanked).toBeGreaterThan(0);
    expect(ticks).toBeLessThan(60 * 120);
    // A clean run: no deaths, at most a couple of hazard touches.
    expect(h.eventsOf('died')).toHaveLength(0);
    console.info(
      `arena run: ${String(ticks)} ticks (${(ticks / 60).toFixed(1)} s), shards ${String(h.world.run.shardsBanked)}, ` +
        `Crawlers ${String(h.eventsOf('enemyDefeated').length)}, hazard hits ${String(h.eventsOf('hazardHit').length)}`,
    );
  });

  it('also finishes on Hard (more Crawler HP and damage, shorter telegraphs)', () => {
    const { h } = runArena('hard');
    expect(h.eventsOf('levelComplete')).toHaveLength(1);
  });

  it('the same run is identical when repeated (deterministic)', () => {
    const a = runArena('normal');
    const b = runArena('normal');
    expect(b.ticks).toBe(a.ticks);
    expect(b.h.world.run).toEqual(a.h.world.run);
  });
});
