export interface StickVector {
  readonly x: number;
  readonly y: number;
}

/** Applies a radial deadzone and rescales the remaining stick travel to [0, 1]. */
export function applyRadialDeadzone(x: number, y: number, deadzone = 0.18): StickVector {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: 0, y: 0 };
  }

  const safeDeadzone = Number.isFinite(deadzone) ? Math.min(Math.max(deadzone, 0), 1) : 0.18;
  const clampedX = Math.min(Math.max(x, -1), 1);
  const clampedY = Math.min(Math.max(y, -1), 1);
  const magnitude = Math.hypot(clampedX, clampedY);

  if (magnitude <= safeDeadzone) {
    return { x: 0, y: 0 };
  }

  const outputMagnitude = Math.min((magnitude - safeDeadzone) / (1 - safeDeadzone), 1);
  const scale = outputMagnitude / magnitude;

  return { x: clampedX * scale, y: clampedY * scale };
}
