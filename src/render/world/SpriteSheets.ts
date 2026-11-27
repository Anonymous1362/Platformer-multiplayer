import type Phaser from 'phaser';
import type { PlayerState } from '../../core/SimulationTypes';

/**
 * Frame sheets: equally sized cells, row-major, frames named "0".."N-1". The same frame indices are
 * used by the baked art (tools/blender) and by the procedural fallback, which paints smaller cells,
 * so code always sizes sprites in world units (`sheetScale`), never in texture pixels.
 */
export interface SheetDef {
  /** Cell size of the baked file in pixels (2x texture density). */
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly count: number;
  /** Drawn size in world units. */
  readonly worldHeight: number;
}

export const SHEETS: Readonly<Record<string, SheetDef>> = {
  char_hero: { frameWidth: 128, frameHeight: 208, count: 28, worldHeight: 104 },
  char_hero_accent: { frameWidth: 128, frameHeight: 208, count: 28, worldHeight: 104 },
  enemy_crawler: { frameWidth: 144, frameHeight: 104, count: 8, worldHeight: 52 },
  pickup_shard: { frameWidth: 64, frameHeight: 64, count: 24, worldHeight: 32 },
};

export const HERO_COLUMNS = 8;

/** Hero clips: first frame index and frame count in the sheet (must match tools/blender/hero.py ANIMS). */
export const HERO_ANIMS = {
  idle: { start: 0, count: 8, fps: 6 },
  run: { start: 8, count: 8, fps: 14 },
  rise: { start: 16, count: 2, fps: 8 },
  fall: { start: 18, count: 2, fps: 8 },
  dash: { start: 20, count: 3, fps: 18 },
  wall: { start: 23, count: 1, fps: 1 },
  hurt: { start: 24, count: 2, fps: 10 },
  jet: { start: 26, count: 2, fps: 12 },
} as const;
export type HeroAnim = keyof typeof HERO_ANIMS;

/** Running speed (u/s) at which the run cycle plays at its nominal rate. */
const RUN_NOMINAL_SPEED = 420;

/** Which clip shows a player state (render-only; reads the state, never writes it). */
export function heroAnimFor(p: PlayerState): HeroAnim {
  if (p.mode === 'dead' || p.mode === 'hazardRespawn') return 'hurt';
  if (p.invulnTicks > 0 && p.controlLockTicks > 0) return 'hurt'; // knockback after a hit
  if (p.mode === 'dash') return 'dash';
  if (p.mode === 'wallSlide') return 'wall';
  if (p.jetpacking) return 'jet';
  if (!p.grounded) return p.vy < 0 ? 'rise' : 'fall';
  return Math.abs(p.vx) > 20 ? 'run' : 'idle';
}

/** The frame name for a player at a render time; the run cycle speeds up with running speed. */
export function heroFrame(p: PlayerState, timeMs: number): string {
  const anim = heroAnimFor(p);
  const clip = HERO_ANIMS[anim];
  let rate = clip.fps;
  if (anim === 'run') rate *= Math.min(1.6, Math.max(0.6, Math.abs(p.vx) / RUN_NOMINAL_SPEED));
  const i = Math.floor((timeMs / 1000) * rate) % clip.count;
  return String(clip.start + i);
}

/** Adds the frames of a baked sheet after its file replaced the texture (no-op for other keys). */
export function addSheetFrames(textures: Phaser.Textures.TextureManager, key: string): void {
  const def = SHEETS[key];
  if (!def || !textures.exists(key)) return;
  const texture = textures.get(key);
  const source = texture.source[0];
  if (!source) return;
  const cols = Math.max(1, Math.floor(source.width / def.frameWidth));
  for (let i = 0; i < def.count; i += 1) {
    const name = String(i);
    if (texture.has(name)) continue;
    texture.add(
      name,
      0,
      (i % cols) * def.frameWidth,
      Math.floor(i / cols) * def.frameHeight,
      def.frameWidth,
      def.frameHeight,
    );
  }
}

/** Scale that draws `key`'s cells at their world height, whichever art (baked or procedural) is installed. */
export function sheetScale(textures: Phaser.Textures.TextureManager, key: string): number {
  const def = SHEETS[key];
  if (!def || !textures.exists(key)) return 1;
  const h = textures.getFrame(key, '0').height;
  return h > 0 ? def.worldHeight / h : 1;
}
