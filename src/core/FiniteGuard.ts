/**
 * N11 dev assertion: finds the first NaN or Infinity anywhere in plain simulation data and reports its
 * path (for example `state.players[1].vx`). Runs every tick in dev builds and tests, so the walk builds
 * the path only after a hit.
 */
function search(value: unknown, seen: Set<object>, trail: (string | number)[]): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const item: unknown = value[i];
      if (typeof item === 'number' ? !Number.isFinite(item) : search(item, seen, trail)) {
        trail.push(i);
        return true;
      }
    }
    return false;
  }
  for (const key of Object.keys(value)) {
    if (search((value as Record<string, unknown>)[key], seen, trail)) {
      trail.push(key);
      return true;
    }
  }
  return false;
}

export function findNonFinite(value: unknown, path = 'state'): string | null {
  const trail: (string | number)[] = [];
  if (!search(value, new Set<object>(), trail)) return null;
  return trail.reduceRight<string>(
    (acc, part) => (typeof part === 'number' ? `${acc}[${String(part)}]` : `${acc}.${part}`),
    path,
  );
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
