import { Button, type InputFrame } from '../../src/core/InputTypes';
import type { Level } from '../../src/core/level/LevelTypes';
import type { PlayerState, WorldState } from '../../src/core/SimulationTypes';
import { input } from './levels';

/**
 * A closed-loop autopilot for `test_arena`: it reads the state the way a player reads the screen and
 * answers with ordinary inputs (move, jump, dash, aimed shots), deciding by position, so a death or a
 * hazard respawn just resumes from wherever the player is put back. Used by the start-to-finish
 * acceptance test and recorded as the `arena_autopilot` golden replay.
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
function aimAtEnemy(world: WorldState, p: PlayerState): { held: number; aimMrad: number } {
  let best: { dx: number; dy: number; d: number } | null = null;
  for (const e of world.enemies) {
    if (e.asleep) continue;
    const dx = e.x - p.x;
    const dy = e.y - 20 - (p.y - 44);
    const d = Math.hypot(dx, dy);
    if (Math.abs(dy) < 160 && d < 700 && (!best || d < best.d)) best = { dx, dy, d };
  }
  if (!best) return { held: 0, aimMrad: 0 };
  return { held: Button.Shoot | Button.AimManual, aimMrad: Math.round(Math.atan2(best.dy, best.dx) * 1000) };
}

function decide(world: WorldState, level: Level, p: PlayerState, pilot: Pilot): InputFrame {
  const plat = world.platforms[0];
  const platW = level.platforms[0]?.w ?? 192;
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
  const shot = aimAtEnemy(world, p);
  return input({ moveX, held: held | shot.held, aimMrad: shot.aimMrad });
}

/** A fresh autopilot (it keeps a little state between ticks, like a held jump). */
export function arenaAutopilot(level: Level): (world: WorldState, slot: number) => InputFrame {
  const pilots = new Map<number, Pilot>();
  return (world, slot) => {
    const p = world.players[slot];
    if (!p) return input();
    let pilot = pilots.get(slot);
    if (!pilot) {
      pilot = newPilot();
      pilots.set(slot, pilot);
    }
    return decide(world, level, p, pilot);
  };
}
