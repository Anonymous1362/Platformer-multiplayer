/**
 * N11 dev assertion: finds the first NaN or Infinity anywhere in plain simulation data and reports its
 * path (for example `players[1].vx`). Run every tick in dev builds and tests.
 */
export function findNonFinite(value: unknown, path = 'state', seen = new Set<object>()): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : path;
  if (typeof value !== 'object' || value === null || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findNonFinite(value[i], `${path}[${String(i)}]`, seen);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    const hit = findNonFinite(child, `${path}.${key}`, seen);
    if (hit) return hit;
  }
  return null;
}

export class NonFiniteStateError extends Error {
  readonly path: string;

  constructor(path: string, tick: number) {
    super(`Non-finite number at ${path} after tick ${String(tick)}`);
    this.name = 'NonFiniteStateError';
    this.path = path;
  }
}

export function assertFiniteState(state: unknown, tick: number): void {
  const path = findNonFinite(state);
  if (path) throw new NonFiniteStateError(path, tick);
}
