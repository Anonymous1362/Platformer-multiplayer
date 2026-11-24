import { GameConfig } from './GameConfig';

export interface FixedStepFrame {
  readonly steps: number;
  readonly interpolationAlpha: number;
}

/** Accumulates wall-clock time into bounded, fixed-rate simulation steps. */
export class FixedStepClock {
  private accumulatedMs = 0;

  advance(frameDeltaMs: number): FixedStepFrame {
    const safeDeltaMs = Number.isFinite(frameDeltaMs)
      ? Math.min(Math.max(frameDeltaMs, 0), GameConfig.maxFrameDeltaMs)
      : 0;

    this.accumulatedMs += safeDeltaMs;
    const dueSteps = Math.floor((this.accumulatedMs + Number.EPSILON * 8) / GameConfig.fixedStepMs);
    const steps = Math.min(dueSteps, GameConfig.maxStepsPerFrame);
    this.accumulatedMs -= steps * GameConfig.fixedStepMs;

    if (dueSteps > GameConfig.maxStepsPerFrame) {
      this.accumulatedMs %= GameConfig.fixedStepMs;
    }

    return {
      steps,
      interpolationAlpha: this.accumulatedMs / GameConfig.fixedStepMs,
    };
  }

  reset(): void {
    this.accumulatedMs = 0;
  }
}
