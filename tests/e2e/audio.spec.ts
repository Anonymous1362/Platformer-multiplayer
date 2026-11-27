import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 1E-3: one AudioContext created on the first gesture, the master limiter, voice caps, and
 * "audio never clips" (an offline worst-case render through the real engine graph).
 */

interface Stats {
  state: string;
  voices: { sfx: number; ui: number };
  played: number;
  stolen: number;
}

async function stats(page: Page): Promise<Stats> {
  return page.evaluate(() => {
    const hooks = window.__CD_TEST__;
    if (!hooks) throw new Error('test hooks missing');
    return JSON.parse(JSON.stringify(hooks.audio.stats())) as Stats;
  });
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  return errors;
}

test('audio starts locked and unlocks on the first gesture; game events play sounds', async ({ page }) => {
  const errors = await boot(page);
  expect((await stats(page)).state).toBe('locked');
  await page.keyboard.press('KeyX'); // a gesture: creates and resumes the context
  await expect.poll(async () => (await stats(page)).state).toBe('running');
  expect(await page.evaluate(() => window.__CD_TEST__?.audio.limiter())).toEqual({
    threshold: -3,
    ratio: 20,
    attack: expect.closeTo(0.003, 4) as unknown,
    release: 0.25,
  });
  await page.keyboard.down('KeyX');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await stats(page)).played, { timeout: 10_000 }).toBeGreaterThan(2);
  await page.keyboard.up('KeyX');
  const s = await stats(page);
  expect(s.voices.sfx).toBeLessThanOrEqual(24);
  expect(errors).toEqual([]);
});

test('audio never clips: a worst-case burst stays under full scale and respects voice caps', async ({
  page,
}) => {
  const errors = await boot(page);
  const result = await page.evaluate(async () => {
    const hooks = window.__CD_TEST__;
    if (!hooks) throw new Error('test hooks missing');
    return hooks.audio.stress();
  });
  expect(result.peak).toBeGreaterThan(0.05); // it is actually loud
  expect(result.peak).toBeLessThan(1); // and never clips
  expect(result.maxSfxVoices).toBeLessThanOrEqual(24);
  expect(result.stolen).toBeGreaterThan(0); // the cap was reached and voices were stolen
  expect(errors).toEqual([]);
});
