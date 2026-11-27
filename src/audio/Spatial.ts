import { SPACE } from './AudioTypes';

/**
 * Where a sound sits in the stereo field (spec 10.4): pan follows the source's horizontal position on
 * screen (at most ±0.6), and sources beyond the screen edge lose about 6 dB per screen width.
 */
export function spatial(
  sourceX: number,
  listenerX: number,
  viewWidthU: number,
): { readonly pan: number; readonly gain: number } {
  if (!Number.isFinite(sourceX) || !Number.isFinite(listenerX) || viewWidthU <= 0) return { pan: 0, gain: 1 };
  const half = viewWidthU / 2;
  const dx = sourceX - listenerX;
  const pan = Math.max(-1, Math.min(1, dx / half)) * SPACE.maxPan;
  const beyond = Math.max(0, Math.abs(dx) - half);
  const db = SPACE.offscreenDbPerScreen * (beyond / viewWidthU);
  return { pan, gain: 10 ** (db / 20) };
}

/** Shard pickups rise in pitch along a chain (spec 10.3): a semitone per shard, up to an octave. */
export class PitchChain {
  private count = -1;
  private lastMs = Number.NEGATIVE_INFINITY;
  private readonly windowMs: number;

  constructor(windowMs = 1200) {
    this.windowMs = windowMs;
  }

  next(nowMs: number): number {
    this.count = nowMs - this.lastMs <= this.windowMs ? this.count + 1 : 0;
    this.lastMs = nowMs;
    return 2 ** (Math.min(this.count, 12) / 12);
  }
}
