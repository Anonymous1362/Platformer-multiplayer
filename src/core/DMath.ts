/**
 * Deterministic trigonometry for the simulation (spec section 13.4). Engine `Math.sin`, `Math.cos`,
 * and `Math.atan2` may differ between JavaScript engines, so the simulation uses these instead.
 * Everything here uses only +, -, *, / (exact IEEE-754 in every engine), plus floor and abs.
 */
export const PI = Math.PI;
export const TAU = PI * 2;
export const HALF_PI = PI / 2;

/** Sine table entries per full turn. */
export const SIN_TABLE_SIZE = 4096;
const QUARTER = SIN_TABLE_SIZE / 4;

/** Taylor series for sin on [0, pi/2]; 13 terms reach full double precision there. */
function seriesSin(x: number): number {
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n <= 13; n += 1) {
    term = (-term * x2) / (2 * n * (2 * n + 1));
    sum += term;
  }
  return sum;
}

const TABLE: Float64Array = (() => {
  const table = new Float64Array(SIN_TABLE_SIZE + 1);
  for (let i = 0; i <= QUARTER; i += 1) table[i] = seriesSin((i / SIN_TABLE_SIZE) * TAU);
  table[0] = 0;
  table[QUARTER] = 1;
  for (let i = 1; i < QUARTER; i += 1) table[2 * QUARTER - i] = table[i] ?? 0;
  table[2 * QUARTER] = 0;
  for (let i = 1; i < 2 * QUARTER; i += 1) table[2 * QUARTER + i] = -(table[i] ?? 0);
  table[SIN_TABLE_SIZE] = 0;
  return table;
})();

/** Read-only view of the table, for tests and hashing. */
export function sinTableEntry(index: number): number {
  return TABLE[index] ?? Number.NaN;
}

/** Sine with linear interpolation between table entries (max error about 3e-7). Non-finite input gives 0. */
export function sin(radians: number): number {
  if (!Number.isFinite(radians)) return 0;
  let pos = (radians / TAU) * SIN_TABLE_SIZE;
  pos -= Math.floor(pos / SIN_TABLE_SIZE) * SIN_TABLE_SIZE;
  const i = Math.floor(pos);
  const a = TABLE[i] ?? 0;
  const b = TABLE[i + 1] ?? 0;
  return a + (b - a) * (pos - i);
}

export function cos(radians: number): number {
  return sin(radians + HALF_PI);
}

const ATAN_COEFFS = [0.99997726, -0.33262347, 0.19354346, -0.11643287, 0.05265332, -0.0117212] as const;

/** Polynomial atan2 in (-pi, pi] (max error about 2e-6 rad). atan2(0, 0) and non-finite input give 0. */
export function atan2(y: number, x: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax === 0 && ay === 0) return 0;
  const swap = ay > ax;
  const t = swap ? ax / ay : ay / ax;
  const t2 = t * t;
  const [c0, c1, c2, c3, c4, c5] = ATAN_COEFFS;
  let r = t * (c0 + t2 * (c1 + t2 * (c2 + t2 * (c3 + t2 * (c4 + t2 * c5)))));
  if (swap) r = HALF_PI - r;
  if (x < 0) r = PI - r;
  return y < 0 ? -r : r;
}

/** Milliradians (the input contract's aim unit) to radians and back. */
export function mradToRadians(mrad: number): number {
  return mrad / 1000;
}

export function radiansToMrad(radians: number): number {
  return Math.round(radians * 1000);
}
