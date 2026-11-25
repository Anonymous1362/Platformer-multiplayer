/** Frame-time telemetry: exponential moving average plus p95 over a ring buffer (M7). */
export class FrameStats {
  private readonly alpha: number;
  private readonly samples: Float64Array;
  private count = 0;
  private head = 0;
  private emaValue = 0;

  constructor(alpha = 0.1, capacity = 240) {
    if (!(alpha > 0 && alpha <= 1)) throw new RangeError('alpha must be in (0, 1]');
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new RangeError('capacity must be a positive integer');
    this.alpha = alpha;
    this.samples = new Float64Array(capacity);
  }

  /** Records one frame's duration in ms. Ignores non-finite or non-positive values; clamps at 1000 ms. */
  record(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    const v = Math.min(frameMs, 1000);
    this.emaValue = this.count === 0 ? v : this.emaValue + this.alpha * (v - this.emaValue);
    this.samples[this.head] = v;
    this.head = (this.head + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
  }

  get emaMs(): number {
    return this.emaValue;
  }

  get fps(): number {
    return this.emaValue > 0 ? 1000 / this.emaValue : 0;
  }

  get sampleCount(): number {
    return this.count;
  }

  /** 95th percentile of the buffered samples (nearest-rank), or 0 with no samples. */
  p95Ms(): number {
    if (this.count === 0) return 0;
    const sorted = Array.from(this.samples.subarray(0, this.count)).sort((a, b) => a - b);
    return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
  }

  reset(): void {
    this.count = 0;
    this.head = 0;
    this.emaValue = 0;
  }
}
