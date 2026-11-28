import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { runReplay, validateReplay } from '../../src/core/Replay';
import { loadLevelById } from '../../tools/shared/levels';

/**
 * Pass 1F: the acceptance run, replay export and re-simulation, 50 clean restarts, Safe Mode, the
 * recoverable-error path, background/resume, and the performance overlay toggle.
 */

interface Probe {
  run: number;
  tick: number;
  paused: boolean;
  complete: boolean;
  quality: string;
  safeMode: boolean;
  players: { x: number; y: number }[];
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const sim = window.__CD_TEST__?.sim();
    if (!sim) throw new Error('no running level');
    return JSON.parse(JSON.stringify(sim)) as Probe;
  });
}

function watch(page: Page): { errors: string[]; foreign: string[] } {
  const seen = { errors: [] as string[], foreign: [] as string[] };
  page.on('pageerror', (e) => seen.errors.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.host !== 'localhost:4173')
      seen.foreign.push(r.url());
  });
  return seen;
}

async function boot(page: Page, size = { width: 960, height: 540 }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 10_000 }).toBeGreaterThan(5);
}

const AUTOPILOT = readFileSync(new URL('../golden/replays/arena_autopilot.json', import.meta.url), 'utf8');

test('acceptance run: the recorded autopilot finishes the arena in the browser with the same hash', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const seen = watch(page);
  await boot(page, { width: 640, height: 360 });
  expect(await page.evaluate((json) => window.__CD_TEST__?.playReplay(json, 8), AUTOPILOT)).toBeNull();
  await expect
    .poll(async () => page.evaluate(() => window.__CD_TEST__?.replayStatus()?.done), { timeout: 200_000 })
    .toBe(true);
  const status = await page.evaluate(() => window.__CD_TEST__?.replayStatus());
  expect(status?.matches, JSON.stringify(status)).toBe(true);
  expect(status?.firstDivergenceTick).toBeNull();
  expect((await probe(page)).complete).toBe(true);
  // Rendering, effects, and audio ran the whole time and changed nothing in the simulation.
  const errors = await page.evaluate(() =>
    (window.__CD_TEST__?.log() ?? []).filter((e) => e.level === 'error'),
  );
  expect(errors).toEqual([]);
  expect(seen.errors).toEqual([]);
  expect(seen.foreign).toEqual([]);
});

test('a live keyboard run exports a replay that re-simulates headlessly to the same hash', async ({
  page,
}) => {
  const seen = watch(page);
  await boot(page);
  // Wait on simulation ticks, not wall time: under load the loop runs fewer ticks per second.
  const start = (await probe(page)).tick;
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyX');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 15_000 }).toBeGreaterThan(start + 60);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 15_000 }).toBeGreaterThan(start + 100);
  await page.keyboard.up('KeyX');
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Escape'); // pause, so the export is the whole run so far
  const json = await page.evaluate(() => window.__CD_TEST__?.replay());
  expect(json).toBeTruthy();
  const parsed = validateReplay(JSON.parse(json ?? 'null'));
  if (!parsed.ok) throw new Error(parsed.error);
  expect(parsed.replay.ticks).toBeGreaterThan(30);
  const result = runReplay(parsed.replay, loadLevelById('test_arena'));
  expect(result.hashMatches).toBe(true);
  expect(result.firstDivergenceTick).toBeNull();
  expect(seen.errors).toEqual([]);
});

test('50 restarts return every counter to its baseline (M8, O5)', async ({ page }) => {
  test.setTimeout(300_000);
  const seen = watch(page);
  await boot(page, { width: 480, height: 270 });
  const restartOnce = async (): Promise<void> => {
    const before = (await probe(page)).run;
    await page.evaluate(() => {
      window.__CD_TEST__?.restartLevel();
    });
    await expect.poll(async () => (await probe(page)).run, { timeout: 15_000 }).toBe(before + 1);
    await expect.poll(async () => (await probe(page)).tick, { timeout: 15_000 }).toBeGreaterThan(3);
  };
  await restartOnce(); // warm-up: lazily created things exist from here on
  const counters = async () => page.evaluate(() => window.__CD_TEST__?.counters());
  const baseline = await counters();
  for (let i = 0; i < 50; i += 1) await restartOnce();
  const after = await counters();
  expect(after?.listeners).toBe(baseline?.listeners);
  expect(after?.timers).toBe(baseline?.timers);
  expect(after?.domNodes).toBe(baseline?.domNodes);
  // Pools (shadows, particles) may hold a couple of extra slots depending on what is on screen at that
  // moment; a leak grows with every restart, so 50 restarts would show it far beyond this margin.
  expect(Math.abs((after?.displayObjects ?? 0) - (baseline?.displayObjects ?? 0))).toBeLessThanOrEqual(4);
  expect(after?.textures).toBe(baseline?.textures);
  expect(after?.tweens).toBe(baseline?.tweens);
  expect(after?.audioVoices).toBe(0);
  console.info(`restart counters: ${JSON.stringify(after)}`);
  expect(seen.errors).toEqual([]);
});

test('two failed boots start Safe Mode with the recovery screen; a good boot clears the flag', async ({
  page,
}) => {
  const seen = watch(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('cd.boot.v1', JSON.stringify({ inProgress: true, failures: 1 }));
    }
  });
  await boot(page);
  const screen = page.locator('[data-role="safe-mode"]');
  await expect(screen).toBeVisible();
  const p = await probe(page);
  expect(p.safeMode).toBe(true);
  expect(p.quality).toBe('battery');
  await screen.locator('[data-action="restart"]').click(); // Continue in Safe Mode
  await expect(screen).toHaveCount(0);
  await page.keyboard.press('KeyX');
  expect(await page.evaluate(() => window.__CD_TEST__?.audio.stats().state)).toBe('unavailable');
  expect(await page.evaluate(() => localStorage.getItem('cd.boot.v1'))).toBe(
    JSON.stringify({ inProgress: false, failures: 0 }),
  );
  const diagnostics = await page.evaluate(() => window.__CD_TEST__?.diagnostics() ?? '');
  expect(JSON.parse(diagnostics)).toMatchObject({ safeMode: true, settings: {} });
  expect(seen.errors).toEqual([]);
});

test('an error inside the level shows a recovery panel; Restart brings the level back', async ({ page }) => {
  const seen = watch(page);
  await boot(page);
  await page.evaluate(() => {
    window.__CD_TEST__?.crash();
  });
  const panel = page.locator('[data-role="error-panel"]');
  await expect(panel).toBeVisible();
  const logged = await page.evaluate(() =>
    (window.__CD_TEST__?.log() ?? []).filter((e) => e.area === 'scene'),
  );
  expect(logged.length).toBeGreaterThan(0);
  const stuck = (await probe(page)).tick;
  await page.waitForTimeout(300);
  expect((await probe(page)).tick).toBe(stuck);
  await panel.locator('[data-action="restart"]').click();
  await expect(panel).toHaveCount(0);
  await expect.poll(async () => (await probe(page)).tick, { timeout: 10_000 }).toBeGreaterThan(5);
  expect(seen.errors).toEqual([]);
});

test('backgrounding pauses; resuming has no tick burst and no teleport', async ({ page }) => {
  const seen = watch(page);
  await boot(page);
  const setHidden = async (hidden: boolean): Promise<void> => {
    await page.evaluate((h) => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (h ? 'hidden' : 'visible'),
      });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  };
  await setHidden(true);
  await expect.poll(async () => (await probe(page)).paused).toBe(true);
  const before = await probe(page);
  await page.waitForTimeout(1500);
  await setHidden(false);
  expect((await probe(page)).tick).toBe(before.tick);
  await page.keyboard.press('Escape'); // resume
  await expect.poll(async () => (await probe(page)).paused).toBe(false);
  const resumed = await probe(page);
  // Resuming never simulates the time spent in the background.
  expect(resumed.tick - before.tick).toBeLessThanOrEqual(8);
  expect(Math.abs((resumed.players[0]?.x ?? 0) - (before.players[0]?.x ?? 0))).toBeLessThan(20);
  expect(seen.errors).toEqual([]);
});

test('the pause menu turns the performance overlay on and off', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#perf-badge')).toBeHidden();
  await page.keyboard.press('Escape');
  const item = page.locator('[data-action="perf"]');
  await expect(item).toHaveText('Performance overlay: Off');
  await item.click();
  await expect(page.locator('[data-action="perf"]')).toHaveText('Performance overlay: On');
  await expect(page.locator('#perf-badge')).toBeVisible();
  await expect(page.locator('#perf-badge')).toHaveText(/fps/, { timeout: 5000 });
  // Pass 2B: the overlay is Settings → Show FPS, stored with the other settings.
  const stored = await page.evaluate(() => localStorage.getItem('cd.settings'));
  expect((JSON.parse(stored ?? '{}') as { graphics?: { showFps?: boolean } }).graphics?.showFps).toBe(true);
});
