import { fnv1a32 } from './Hash.ts';
import type { EntityPoolSnapshot } from './EntityIds.ts';
import type { InputFrame } from './InputFrame.ts';
import type { WorldState } from './WorldSimulation.ts';

export const FNV1A_OFFSET_BASIS = 0x811c9dc5;

function appendFloat64(bytes: number[], value: number): void {
  const storage = new ArrayBuffer(8);
  new DataView(storage).setFloat64(0, value, true);
  const encoded = new Uint8Array(storage);
  for (const byte of encoded) {
    bytes.push(byte);
  }
}

function appendInputFrames(bytes: number[], frames: readonly InputFrame[]): void {
  appendFloat64(bytes, frames.length);
  for (const frame of frames) {
    appendFloat64(bytes, frame.moveX);
    appendFloat64(bytes, frame.moveY);
    appendFloat64(bytes, frame.held);
    appendFloat64(bytes, frame.aimMrad);
  }
}

export function updateInputDigest(previousDigest: number, frames: readonly InputFrame[]): number {
  const bytes: number[] = [];
  appendInputFrames(bytes, frames);
  return fnv1a32(Uint8Array.from(bytes), previousDigest);
}

function appendEntityPool(bytes: number[], entityPool: EntityPoolSnapshot): void {
  appendFloat64(bytes, entityPool.slots.length);
  for (const slot of entityPool.slots) {
    appendFloat64(bytes, slot.generation);
    bytes.push(Number(slot.active));
  }
}

/** FNV-1a over a fixed field order, with every numeric state value encoded as Float64LE. */
export function hashWorldState(state: WorldState): string {
  const bytes: number[] = [];
  appendFloat64(bytes, state.schemaVersion);
  appendFloat64(bytes, state.tick);
  appendFloat64(bytes, state.seed);
  appendFloat64(bytes, state.inputDigest);
  appendFloat64(bytes, state.players.length);
  for (const player of state.players) {
    appendFloat64(bytes, player.moveX);
    appendFloat64(bytes, player.moveY);
    appendFloat64(bytes, player.held);
    appendFloat64(bytes, player.aimMrad);
    appendFloat64(bytes, player.pressed);
    appendFloat64(bytes, player.released);
  }
  appendFloat64(bytes, state.randomState.length);
  for (const word of state.randomState) {
    appendFloat64(bytes, word);
  }
  appendEntityPool(bytes, state.entities);
  return fnv1a32(Uint8Array.from(bytes)).toString(16).padStart(8, '0');
}

export const StateHash = {
  world: hashWorldState,
};
