const TABLE_SIZE = 4096;
const TABLE_MASK = TABLE_SIZE - 1;
const TWO_PI = Math.PI * 2;
const SIN_TABLE = new Float64Array(TABLE_SIZE);

for (let index = 0; index < TABLE_SIZE; index += 1) {
  SIN_TABLE[index] = Math.sin((index / TABLE_SIZE) * TWO_PI);
}

function angleIndex(angleRad: number): number {
  if (!Number.isFinite(angleRad)) {
    throw new RangeError('Deterministic trigonometry requires a finite angle.');
  }

  const wrapped = angleRad % TWO_PI;
  return Math.round((wrapped / TWO_PI) * TABLE_SIZE) & TABLE_MASK;
}

export function sin(angleRad: number): number {
  return SIN_TABLE[angleIndex(angleRad)] ?? 0;
}

export function cos(angleRad: number): number {
  return SIN_TABLE[(angleIndex(angleRad) + TABLE_SIZE / 4) & TABLE_MASK] ?? 0;
}

function polynomialAtan(unitValue: number): number {
  const square = unitValue * unitValue;
  const polynomial =
    0.999866 +
    square * (-0.3302995 + square * (0.180141 + square * (-0.085133 + square * 0.0208351)));
  return unitValue * polynomial;
}

/** Deterministic polynomial approximation with explicit handling of every quadrant. */
export function atan2(y: number, x: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('Deterministic atan2 requires finite coordinates.');
  }
  if (x === 0 && y === 0) {
    return 0;
  }

  const absoluteX = Math.abs(x);
  const absoluteY = Math.abs(y);
  const acuteAngle =
    absoluteX >= absoluteY
      ? polynomialAtan(absoluteY / absoluteX)
      : Math.PI / 2 - polynomialAtan(absoluteX / absoluteY);

  if (x < 0) {
    return y < 0 ? acuteAngle - Math.PI : Math.PI - acuteAngle;
  }
  return y < 0 ? -acuteAngle : acuteAngle;
}

export const DMath = { sin, cos, atan2 } as const;
