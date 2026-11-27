import type { QualityTier } from '../render/fx/FxMath';
import type { Capabilities } from './Capabilities';
import { FrameStats } from './FrameStats';

const ORDER: readonly QualityTier[] = ['battery', 'balanced', 'high'];

/** Tier rules (spec 18.2, O6). */
export const QUALITY_RULES = {
  dropAboveMs: 20,
  dropAfterMs: 3000,
  raiseBelowMs: 12,
  raiseAfterMs: 10_000,
  raiseCooldownMs: 30_000,
} as const;

/** First-boot heuristic from the capability matrix (spec 18.2); the stress render comes with 2A's title. */
export function initialTier(
  c: Pick<Capabilities, 'softwareRenderer' | 'deviceMemoryGb' | 'cpuCores' | 'touch' | 'maxTextureSize'>,
): QualityTier {
  if (c.softwareRenderer) return 'battery';
  if (c.deviceMemoryGb !== null && c.deviceMemoryGb <= 3) return 'battery';
  if (c.maxTextureSize > 0 && c.maxTextureSize < 4096) return 'battery';
  if (!c.touch && c.cpuCores >= 8 && (c.deviceMemoryGb ?? 8) >= 8) return 'high';
  return 'balanced';
}

/**
 * Adaptive quality, basic version (O6): a rolling p95 of frame time drops a tier after 3 s above
 * 20 ms and raises one after 10 s below 12 ms, at least 30 s after the last change. Changes wait for
 * the next scene boundary (`takeTierForScene`). A manual preset turns the automatic changes off.
 */
export class QualityGovernor {
  private current: QualityTier;
  private pendingTier: QualityTier | null = null;
  private readonly manual: boolean;
  private readonly stats = new FrameStats(0.1, 120);
  private aboveSince: number | null = null;
  private belowSince: number | null = null;
  private lastChangeMs = 0;
  private readonly changes: {
    readonly atMs: number;
    readonly from: QualityTier;
    readonly to: QualityTier;
  }[] = [];

  constructor(initial: QualityTier, options: { readonly manual?: boolean; readonly nowMs?: number } = {}) {
    this.current = initial;
    this.manual = options.manual ?? false;
    this.lastChangeMs = options.nowMs ?? 0;
  }

  get tier(): QualityTier {
    return this.current;
  }

  get pending(): QualityTier | null {
    return this.pendingTier;
  }

  get history(): readonly { readonly atMs: number; readonly from: QualityTier; readonly to: QualityTier }[] {
    return this.changes;
  }

  get p95Ms(): number {
    return this.stats.p95Ms();
  }

  /** One rendered frame. Paused or hidden time should not be fed in. */
  sample(frameMs: number, nowMs: number): void {
    this.stats.record(frameMs);
    if (this.manual || this.stats.sampleCount < 30) return;
    const p95 = this.stats.p95Ms();
    const target = this.pendingTier ?? this.current;
    const index = ORDER.indexOf(target);
    if (p95 > QUALITY_RULES.dropAboveMs) {
      this.belowSince = null;
      this.aboveSince ??= nowMs;
      if (nowMs - this.aboveSince >= QUALITY_RULES.dropAfterMs && index > 0) {
        this.request(ORDER[index - 1] ?? target, nowMs);
      }
    } else if (p95 < QUALITY_RULES.raiseBelowMs) {
      this.aboveSince = null;
      this.belowSince ??= nowMs;
      if (
        nowMs - this.belowSince >= QUALITY_RULES.raiseAfterMs &&
        nowMs - this.lastChangeMs >= QUALITY_RULES.raiseCooldownMs &&
        index < ORDER.length - 1
      ) {
        this.request(ORDER[index + 1] ?? target, nowMs);
      }
    } else {
      this.aboveSince = null;
      this.belowSince = null;
    }
  }

  private request(tier: QualityTier, nowMs: number): void {
    this.changes.push({ atMs: nowMs, from: this.pendingTier ?? this.current, to: tier });
    this.pendingTier = tier === this.current ? null : tier;
    this.lastChangeMs = nowMs;
    this.aboveSince = null;
    this.belowSince = null;
    this.stats.reset();
  }

  /** Scene boundary: applies a pending change and returns the tier to build the scene with. */
  takeTierForScene(): QualityTier {
    if (this.pendingTier !== null) {
      this.current = this.pendingTier;
      this.pendingTier = null;
    }
    return this.current;
  }
}
