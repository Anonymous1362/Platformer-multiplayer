import { describe, expect, it } from 'vitest';
import { FRAME_SAMPLE_CAPACITY, FrameTelemetry } from '../../src/render/FrameTelemetry';

describe('FrameTelemetry', () => {
  it('tracks frame EMA and percentile samples while ignoring invalid values', () => {
    const telemetry = new FrameTelemetry();
    telemetry.recordFrameDelta(16);
    telemetry.recordFrameDelta(20);
    telemetry.recordFrameDelta(Number.NaN);
    telemetry.record('render', 3);
    telemetry.record('render', 7);
    telemetry.record('network', -1);

    const snapshot = telemetry.snapshot();
    expect(snapshot.frameDeltaMs.sampleCount).toBe(2);
    expect(snapshot.frameDeltaMs.emaMs).toBeCloseTo(16.4);
    expect(snapshot.metrics.render.p95Ms).toBe(7);
    expect(snapshot.metrics.network.sampleCount).toBe(0);
  });

  it('bounds retained percentile samples', () => {
    const telemetry = new FrameTelemetry();
    for (let index = 0; index < FRAME_SAMPLE_CAPACITY + 5; index += 1) {
      telemetry.record('update', index);
    }

    expect(telemetry.snapshot().metrics.update.sampleCount).toBe(FRAME_SAMPLE_CAPACITY);
  });
});
