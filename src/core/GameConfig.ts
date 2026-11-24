export const GameConfig = {
  simulationHz: 60,
  fixedStepMs: 1000 / 60,
  maxFrameDeltaMs: 100,
  maxStepsPerFrame: 4,
} as const;
