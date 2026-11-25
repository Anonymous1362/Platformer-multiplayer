export type RandomState = readonly [number, number, number, number];

/** One splitmix32 step; used only to expand a seed into generator state. */
function splitmix32(seed: number): [number, number] {
  const next = (seed + 0x9e3779b9) | 0;
  let z = next ^ (next >>> 16);
  z = Math.imul(z, 0x21f0aaad);
  z ^= z >>> 15;
  z = Math.imul(z, 0x735a2d97);
  z ^= z >>> 15;
  return [next, z >>> 0];
}

/**
 * Seeded sfc32 generator for the deterministic simulation (spec section 13.4).
 * The same seed always produces the same sequence in every JavaScript engine.
 */
export class Random {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    let s = seed | 0;
    let out: number;
    [s, out] = splitmix32(s);
    this.a = out | 0;
    [s, out] = splitmix32(s);
    this.b = out | 0;
    [s, out] = splitmix32(s);
    this.c = out | 0;
    [s, out] = splitmix32(s);
    this.d = out | 0;
    for (let i = 0; i < 15; i += 1) this.nextU32();
  }

  static fromState(state: RandomState): Random {
    const rng = new Random(0);
    [rng.a, rng.b, rng.c, rng.d] = [state[0] | 0, state[1] | 0, state[2] | 0, state[3] | 0];
    return rng;
  }

  /** Snapshot for hashing, replays, and saves. */
  state(): RandomState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  /** Unsigned 32-bit integer. */
  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Float in [0, 1). */
  nextFloat(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [0, maxExclusive) without modulo bias. */
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 4294967296) {
      throw new RangeError(`maxExclusive must be an integer in 1..2^32, got ${String(maxExclusive)}`);
    }
    const limit = 4294967296 - (4294967296 % maxExclusive);
    let value = this.nextU32();
    while (value >= limit) value = this.nextU32();
    return value % maxExclusive;
  }
}
