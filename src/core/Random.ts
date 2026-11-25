export type RandomState = readonly [number, number, number, number];

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function mixSeed(value: number): number {
  let mixed = value;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
  return (mixed ^ (mixed >>> 15)) >>> 0;
}

/** xoshiro128** PRNG with a serializable four-word state for deterministic replays. */
export class SeededRandom {
  private state: [number, number, number, number];

  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new RangeError('Seed must be a finite number.');
    }

    let cursor = Math.trunc(Math.min(0xffff_ffff, Math.max(0, seed))) >>> 0;
    const state: [number, number, number, number] = [0, 0, 0, 0];
    for (let index = 0; index < state.length; index += 1) {
      cursor = (cursor + 0x9e3779b9) >>> 0;
      state[index] = mixSeed(cursor);
    }
    if (state.every((word) => word === 0)) {
      state[0] = 1;
    }
    this.state = state;
  }

  nextUint32(): number {
    const [state0, state1, state2, state3] = this.state;
    const result = Math.imul(rotateLeft(Math.imul(state1, 5) >>> 0, 7), 9) >>> 0;
    const shiftedState2 = (state1 << 9) >>> 0;

    this.state[2] = (state2 ^ state0) >>> 0;
    this.state[3] = (state3 ^ state1) >>> 0;
    this.state[1] = (state1 ^ this.state[2]) >>> 0;
    this.state[0] = (state0 ^ this.state[3]) >>> 0;
    this.state[2] = (this.state[2] ^ shiftedState2) >>> 0;
    this.state[3] = rotateLeft(this.state[3], 11);

    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  snapshot(): RandomState {
    return [...this.state];
  }

  restore(snapshot: unknown): void {
    if (
      !Array.isArray(snapshot) ||
      snapshot.length !== 4 ||
      !snapshot.every(
        (word: unknown) =>
          typeof word === 'number' && Number.isInteger(word) && word >= 0 && word <= 0xffff_ffff,
      )
    ) {
      throw new TypeError('Random state must be four unsigned 32-bit integers.');
    }
    if (snapshot.every((word: number) => word === 0)) {
      throw new RangeError('The all-zero xoshiro state is invalid.');
    }

    this.state = [snapshot[0], snapshot[1], snapshot[2], snapshot[3]];
  }
}
