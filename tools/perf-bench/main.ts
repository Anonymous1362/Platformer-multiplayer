// Simulation benchmark (spec sections 18 and 20.6). Fails if the mean step time exceeds the budget.
// Usage: npm run perf:bench
import { CONFIG_HASH } from '../../src/core/GameConfig';
import { createWorld, WorldSimulation } from '../../src/core/WorldSimulation';
import { scriptedInput } from '../../tests/fixtures/scenarios';

/** Spec budget for a full simulation step (4 players plus enemies, projectiles, and pickups). */
const BUDGET_MS = 2.0;
const WARMUP_TICKS = 2000;
const MEASURED_TICKS = 20000;

const world = createWorld({
  seed: 42,
  planet: 'obsidian',
  difficulty: 'normal',
  playerCount: 4,
  floorY: 2000,
  worldWidth: 60000,
  spawnX: 30000,
});
const sim = new WorldSimulation();
const samples: number[] = [];

for (let tick = 0; tick < WARMUP_TICKS + MEASURED_TICKS; tick += 1) {
  const frames = world.players.map((p) => scriptedInput(tick, p.slot));
  const start = performance.now();
  sim.step(world, frames, tick);
  if (tick >= WARMUP_TICKS) samples.push(performance.now() - start);
}

samples.sort((a, b) => a - b);
const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? 0;
console.log(
  JSON.stringify(
    {
      configHash: CONFIG_HASH,
      players: world.players.length,
      ticks: MEASURED_TICKS,
      meanMs: Number(mean.toFixed(5)),
      p95Ms: Number(p95.toFixed(5)),
      budgetMs: BUDGET_MS,
      note: 'Pass 1B skeleton: players only. Enemies, projectiles, and pickups arrive in later passes.',
    },
    null,
    2,
  ),
);
process.exit(mean <= BUDGET_MS ? 0 : 1);
