export const FRAME_SAMPLE_CAPACITY = 120;
export const EMA_SMOOTHING = 0.1;

export type FrameMetric = 'update' | 'render' | 'simulation' | 'network';

export interface MetricSummary {
  readonly sampleCount: number;
  readonly emaMs: number;
  readonly p95Ms: number;
}

export interface FrameTelemetrySnapshot {
  readonly frameDeltaMs: MetricSummary;
  readonly metrics: Readonly<Record<FrameMetric, MetricSummary>>;
}

const metricNames: readonly FrameMetric[] = ['update', 'render', 'simulation', 'network'];

function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) {
    return 0;
  }

  const ordered = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(ordered.length * 0.95) - 1);
  return ordered[index] ?? 0;
}

/** Render-side frame/update measurements. Simulation and network remain unsampled until their passes. */
export class FrameTelemetry {
  private frameDeltaEmaMs = 0;
  private frameSamples: number[] = [];
  private readonly metricEma = new Map<FrameMetric, number>();
  private readonly metricSamples = new Map<FrameMetric, number[]>();

  constructor() {
    for (const name of metricNames) {
      this.metricEma.set(name, 0);
      this.metricSamples.set(name, []);
    }
  }

  recordFrameDelta(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      return;
    }
    this.frameDeltaEmaMs = this.updateEma(this.frameDeltaEmaMs, deltaMs);
    this.pushSample(this.frameSamples, deltaMs);
  }

  record(metric: FrameMetric, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    const samples = this.metricSamples.get(metric);
    if (samples === undefined) {
      return;
    }
    this.metricEma.set(metric, this.updateEma(this.metricEma.get(metric) ?? 0, durationMs));
    this.pushSample(samples, durationMs);
  }

  snapshot(): FrameTelemetrySnapshot {
    const metrics = Object.fromEntries(
      metricNames.map((name) => {
        const samples = this.metricSamples.get(name) ?? [];
        return [name, this.summary(samples, this.metricEma.get(name) ?? 0)];
      }),
    ) as Record<FrameMetric, MetricSummary>;

    return {
      frameDeltaMs: this.summary(this.frameSamples, this.frameDeltaEmaMs),
      metrics,
    };
  }

  private updateEma(previous: number, sample: number): number {
    return previous === 0 ? sample : previous + EMA_SMOOTHING * (sample - previous);
  }

  private pushSample(samples: number[], sample: number): void {
    samples.push(sample);
    if (samples.length > FRAME_SAMPLE_CAPACITY) {
      samples.shift();
    }
  }

  private summary(samples: readonly number[], emaMs: number): MetricSummary {
    return {
      sampleCount: samples.length,
      emaMs,
      p95Ms: percentile95(samples),
    };
  }
}
