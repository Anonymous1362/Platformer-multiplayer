/** Simulation step length in seconds (contract, spec section 13.2). */
export const FIXED_DT = 1 / 60;
/** Real frame time above this is clamped before use. */
export const MAX_FRAME_DELTA_S = 0.1;
/** Simulation steps per rendered frame; any backlog beyond this is dropped. */
export const MAX_STEPS_PER_FRAME = 4;

const EPSILON = 1e-9;

export interface FixedLoopResult {
  /** Steps run this frame. */
  readonly steps: number;
  /** Fraction of a step left over, 0 <= alpha < 1. Rendering only. */
  readonly renderAlpha: number;
  /** True when backlog was discarded because the frame needed more than the step cap. */
  readonly droppedBacklog: boolean;
}

/**
 * Turns real frame time into zero or more fixed simulation steps.
 * It never reads a clock: callers pass the elapsed time in seconds.
 */
export class FixedLoop {
  private accumulatorS = 0;
  private speedScale = 1;
  private tickCount = 0;

  /** Number of steps run since creation or the last {@link reset}. */
  get tick(): number {
    return this.tickCount;
  }

  /** Assist game speed (for example 0.7, 0.8, 0.9). Scales real time, never FIXED_DT. */
  setSpeedScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
      throw new RangeError(`speed scale must be in (0, 1], got ${String(scale)}`);
    }
    this.speedScale = scale;
  }

  /** Call after pause, backgrounding, or a WebGL context restore. */
  reset(): void {
    this.accumulatorS = 0;
  }

  /** Feed one rendered frame. `onStep` receives the tick number being simulated, starting at 0. */
  advance(realDeltaS: number, onStep: (tick: number) => void): FixedLoopResult {
    if (Number.isFinite(realDeltaS) && realDeltaS > 0) {
      this.accumulatorS += Math.min(realDeltaS, MAX_FRAME_DELTA_S) * this.speedScale;
    }

    let steps = 0;
    while (steps < MAX_STEPS_PER_FRAME && this.accumulatorS + EPSILON >= FIXED_DT) {
      onStep(this.tickCount);
      this.tickCount += 1;
      this.accumulatorS = Math.max(0, this.accumulatorS - FIXED_DT);
      steps += 1;
    }

    let droppedBacklog = false;
    if (this.accumulatorS + EPSILON >= FIXED_DT) {
      this.accumulatorS = 0;
      droppedBacklog = true;
    }

    return { steps, renderAlpha: Math.min(this.accumulatorS / FIXED_DT, 1 - EPSILON), droppedBacklog };
  }
}
