import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 1E-2: HUD, pause menu with Restart, clean restarts, reduced motion, and WebGL context loss.
 * Uses the read-only `?test=1` probe (`window.__CD_TEST__.sim()`).
 */

interface Probe {
  tick: number;
  paused: boolean;
  menuOpen: boolean;
  contextLost: boolean;
  fx: { particles: number; sprites: number; shake: number };
  shards: { banked: number; carried: number };
  players: { x: number; y: number; hp: number }[];
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const sim = window.__CD_TEST__?.sim();
    if (!sim) throw new Error('no running level');
    return JSON.parse(JSON.stringify(sim)) as Probe;
  });
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 10_000 }).toBeGreaterThan(5);
  return errors;
}

test('the HUD shows full HP, shield, fuel, and zero shards at the start', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('[data-role="hud"]')).toHaveCount(1);
  await expect(page.locator('[data-hud="hp"]')).toBeVisible();
  await expect(page.locator('[data-hud="shard-count"]')).toHaveText('0');
  const hpBox = await page.locator('[data-hud="hp"]').boundingBox();
  expect(Math.round(hpBox?.width ?? 0)).toBe(280);
  expect(Math.round(hpBox?.height ?? 0)).toBe(18);
  expect(errors).toEqual([]);
});

test('pause menu: arrows pick Restart, Enter restarts the arena', async ({ page }) => {
  const errors = await boot(page);
  const spawn = (await probe(page)).players[0];
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await probe(page)).players[0]?.x ?? 0).toBeGreaterThan((spawn?.x ?? 0) + 60);
  await page.keyboard.up('KeyD');

  await page.keyboard.press('Escape');
  const menu = page.locator('[data-role="pause-overlay"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-action="resume"]')).toHaveAttribute('data-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('[data-action="restart"]')).toHaveAttribute('data-selected', 'true');
  const before = (await probe(page)).tick;
  await page.keyboard.press('Enter');

  await expect(menu).toHaveCount(0);
  await expect.poll(async () => (await probe(page)).tick).toBeLessThan(before);
  const after = await probe(page);
  expect(after.paused).toBe(false);
  expect(Math.abs((after.players[0]?.x ?? 0) - (spawn?.x ?? 0))).toBeLessThan(2);
  await expect(page.locator('[data-role="hud"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('pause menu works with the mouse: Resume continues the level', async ({ page }) => {
  const errors = await boot(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).menuOpen).toBe(true);
  const tick = (await probe(page)).tick;
  await page.locator('[data-action="resume"]').click();
  await expect.poll(async () => (await probe(page)).tick).toBeGreaterThan(tick);
  expect((await probe(page)).menuOpen).toBe(false);
  expect(errors).toEqual([]);
});

test('ten restarts in a row leave no extra HUD, menus, or sprites behind', async ({ page }) => {
  test.setTimeout(120_000); // each restart rebuilds the level; slow under software WebGL
  const errors = await boot(page);
  const baseline = await probe(page);
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-action="restart"]')).toBeVisible();
    await page.locator('[data-action="restart"]').click();
    await expect(page.locator('[data-role="pause-overlay"]')).toHaveCount(0);
    await expect.poll(async () => (await probe(page)).tick).toBeGreaterThan(5);
  }
  await expect(page.locator('[data-role="hud"]')).toHaveCount(1);
  await expect(page.locator('[data-role="touch-controls"]')).toHaveCount(1);
  const after = await probe(page);
  expect(after.fx.sprites).toBe(baseline.fx.sprites);
  expect(await page.locator('#game-root > *').count()).toBeLessThanOrEqual(4);
  expect(errors).toEqual([]);
});

test('a lost WebGL context pauses the level; after the restore it resumes', async ({ page }) => {
  const errors = await boot(page);
  const lost = await page.evaluate(() => {
    const canvas = document.querySelector('#game-root canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
    ext.loseContext();
    return true;
  });
  test.skip(!lost, 'WEBGL_lose_context is not available in this browser');

  await expect.poll(async () => (await probe(page)).contextLost).toBe(true);
  expect((await probe(page)).paused).toBe(true);
  await expect(page.locator('[data-role="context-lost"]')).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext();
  });
  await expect.poll(async () => (await probe(page)).contextLost, { timeout: 10_000 }).toBe(false);
  await expect(page.locator('[data-role="context-lost"]')).toHaveCount(0);
  const tick = (await probe(page)).tick;
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 10_000 }).toBeGreaterThan(tick);
  expect(errors).toEqual([]);
});

test('reduced motion: detected, the game plays, and camera shake stays capped', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await boot(page);
  expect(await page.evaluate(() => window.__CD_TEST__?.capabilities.reducedMotion)).toBe(true);
  // Walk right into the first Crawler's patrol and keep firing for a few seconds.
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyX');
  let maxShake = 0;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(150);
    maxShake = Math.max(maxShake, (await probe(page)).fx.shake);
  }
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyX');
  expect(maxShake).toBeLessThanOrEqual(0.25);
  expect(errors).toEqual([]);
});
