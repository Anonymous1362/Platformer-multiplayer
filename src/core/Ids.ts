/** String-literal ID unions from spec Appendix B. `tests/unit/ids.test.ts` checks them against the spec. */
export const PLANET_IDS = ['kepler', 'vulcanis', 'cryos', 'aether', 'obsidian'] as const;
export type PlanetId = (typeof PLANET_IDS)[number];

export const DIFFICULTY_IDS = ['easy', 'normal', 'hard', 'drift_plus'] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export function isPlanetId(value: unknown): value is PlanetId {
  return typeof value === 'string' && (PLANET_IDS as readonly string[]).includes(value);
}

export function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === 'string' && (DIFFICULTY_IDS as readonly string[]).includes(value);
}
