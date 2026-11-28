import type { SfxKey } from './SynthRecipes';

/**
 * Sound captions (spec 7.5, 8.12): sounds that carry information you cannot always see get a short
 * caption, with an arrow when the source is off screen. Captions also show while the game is muted.
 */
export const CAPTION_KEYS: Readonly<Partial<Record<SfxKey, string>>> = {
  sfx_crawler_alert: 'caption.crawlerAlert',
  sfx_crawler_windup: 'caption.crawlerWindup',
  sfx_overheat_vent: 'caption.vent',
  sfx_heartbeat: 'caption.heartbeat',
};

export type CaptionDirection = 'left' | 'right' | null;

/** Off screen to the left or right of the view, or null while the source is visible (or has no place). */
export function captionDirection(
  x: number | undefined,
  listenerX: number,
  viewWidthU: number,
): CaptionDirection {
  if (x === undefined) return null;
  const half = viewWidthU / 2;
  if (x < listenerX - half) return 'left';
  if (x > listenerX + half) return 'right';
  return null;
}

export const CAPTION_MS = 2500;
export const MAX_CAPTIONS = 3;

export interface CaptionLine {
  readonly key: string;
  readonly direction: CaptionDirection;
  readonly until: number;
}

/** At most three lines; a repeated sound refreshes its line instead of stacking. */
export class CaptionQueue {
  private lines: CaptionLine[] = [];

  add(key: string, direction: CaptionDirection, nowMs: number): void {
    this.lines = this.lines.filter((l) => l.key !== key && l.until > nowMs);
    this.lines.push({ key, direction, until: nowMs + CAPTION_MS });
    if (this.lines.length > MAX_CAPTIONS) this.lines = this.lines.slice(-MAX_CAPTIONS);
  }

  visible(nowMs: number): readonly CaptionLine[] {
    this.lines = this.lines.filter((l) => l.until > nowMs);
    return this.lines;
  }

  clear(): void {
    this.lines = [];
  }
}
