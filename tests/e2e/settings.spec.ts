import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 2B-1: Settings (spec 8.6, 15.3). Every tab passes axe; changes apply live and persist across a
 * reload; one bad stored value falls back alone; Restore defaults resets one tab; Esc closes only the
 * pop-up. Uses the read-only `?test=1` hooks.
 */

interface Probe {
  tick: number;
  paused: boolean;
  difficulty: string;
  assists: number;
  run: number;
  lastFrame: { held: number };
}

const SHOOT = 1 << 2;

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const sim = window.__CD_TEST__?.sim();
    if (!sim) throw new Error('no running level');
    return JSON.parse(JSON.stringify(sim)) as Probe;
  });
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
}

async function axe(page: Page): Promise<void> {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Owner decision 2026-11-27 (docs/DECISIONS.md): spec N14 keeps browser zoom off.
    .disableRules(['meta-viewport'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

async function bootLevel(page: Page, size = { width: 1280, height: 720 }): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize(size);
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 10_000 }).toBeGreaterThan(5);
  return errors;
}

async function openSettingsFromPause(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-role="pause-overlay"]')).toBeVisible();
  await page.locator('[data-role="pause-overlay"] [data-action="settings"]').click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
}

const settingsOf = (page: Page): Promise<Record<string, Record<string, unknown>>> =>
  page.evaluate(
    () =>
      JSON.parse(JSON.stringify(window.__CD_TEST__?.settings() ?? {})) as Record<
        string,
        Record<string, unknown>
      >,
  );

test('every settings tab passes axe', async ({ page }) => {
  test.setTimeout(120_000); // eight full axe scans on software WebGL
  const errors = await bootLevel(page);
  await openSettingsFromPause(page);
  for (const name of [
    'Audio',
    'Graphics',
    'Controls',
    'Gameplay',
    'Accessibility',
    'Language',
    'Data',
    'About',
  ]) {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    await axe(page);
  }
  expect(errors).toEqual([]);
});

test('a volume change applies live and survives a reload', async ({ page }) => {
  await bootLevel(page);
  await page.mouse.click(400, 300); // a gesture unlocks audio
  await openSettingsFromPause(page);
  const slider = page.getByRole('slider', { name: 'Master volume' });
  await slider.focus();
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveValue('50');
  await expect.poll(() => page.evaluate(() => window.__CD_TEST__?.audio.mix().master)).toBeCloseTo(0.5);
  expect((await settingsOf(page))['audio']?.['master']).toBe(50);

  await page.reload();
  await page.waitForSelector('#game-root[data-ready="true"]');
  expect((await settingsOf(page))['audio']?.['master']).toBe(50);
  await page.mouse.click(400, 300);
  await expect.poll(() => page.evaluate(() => window.__CD_TEST__?.audio.mix().master)).toBeCloseTo(0.5);
  await openSettingsFromPause(page);
  await expect(page.getByRole('slider', { name: 'Master volume' })).toHaveValue('50');
});

test('mono and night mode reach the mixer', async ({ page }) => {
  await bootLevel(page);
  await page.mouse.click(400, 300);
  await openSettingsFromPause(page);
  await page.getByRole('switch', { name: 'Mono audio' }).click();
  await page.getByRole('radio', { name: 'Night' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__CD_TEST__?.audio.mix()))
    .toMatchObject({ mono: true, night: true });
});

test('Restore defaults resets only the current tab', async ({ page }) => {
  await bootLevel(page);
  await openSettingsFromPause(page);
  await page.getByRole('switch', { name: 'Mono audio' }).click();
  await page.getByRole('tab', { name: 'Gameplay' }).click();
  await page.getByRole('switch', { name: 'Damage numbers' }).click();
  await page.getByRole('tab', { name: 'Audio' }).click();
  await page.locator('[data-action="restore-defaults"]').click();
  const s = await settingsOf(page);
  expect(s['audio']?.['mono']).toBe(false);
  expect(s['gameplay']?.['damageNumbers']).toBe(false);
});

test('one invalid stored value falls back alone', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await page.evaluate(() => {
    localStorage.setItem(
      'cd.settings',
      JSON.stringify({ version: 1, audio: { master: 'loud', music: 33 }, gameplay: { cameraShake: 40 } }),
    );
  });
  await page.reload();
  await page.waitForSelector('#game-root[data-ready="true"]');
  const s = await settingsOf(page);
  expect(s['audio']?.['master']).toBe(80);
  expect(s['audio']?.['music']).toBe(33);
  expect(s['gameplay']?.['cameraShake']).toBe(40);
  const log = await page.evaluate(() => window.__CD_TEST__?.log().map((e) => e.msg) ?? []);
  expect(log.some((m) => m.includes('audio.master'))).toBe(true);
});

test('difficulty and assists apply at the next restart; the frame cap applies at once', async ({ page }) => {
  await bootLevel(page);
  expect((await probe(page)).difficulty).toBe('normal');
  await openSettingsFromPause(page);
  await page.getByRole('tab', { name: 'Gameplay' }).click();
  await page.getByRole('radio', { name: 'Easy' }).click();
  await page.getByRole('switch', { name: 'Infinite jetpack fuel' }).click();
  await page.getByRole('tab', { name: 'Graphics' }).click();
  await page.getByRole('radio', { name: '30', exact: true }).click();
  expect(await page.evaluate(() => window.__CD_TEST__?.fpsLimit())).toBe(30);
  expect((await probe(page)).difficulty).toBe('normal'); // the running level keeps its rules
  await page.locator('[data-action="close-settings"]').click();
  const before = (await probe(page)).run;
  await page.locator('[data-role="pause-overlay"] [data-action="restart"]').click();
  await expect.poll(async () => (await probe(page)).run).toBe(before + 1);
  const p = await probe(page);
  expect(p.difficulty).toBe('easy');
  expect(p.assists).toBe(2);
});

test('shoot toggle: one tap keeps firing until the next tap', async ({ page }) => {
  await bootLevel(page);
  await openSettingsFromPause(page);
  await page.getByRole('tab', { name: 'Controls' }).click();
  await page.getByRole('radio', { name: 'Toggle' }).click();
  await page.locator('[data-action="close-settings"]').click();
  await page.keyboard.press('Escape'); // resume
  await expect.poll(async () => (await probe(page)).paused).toBe(false);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => ((await probe(page)).lastFrame.held & SHOOT) !== 0).toBe(true);
  await page.waitForTimeout(300);
  expect(((await probe(page)).lastFrame.held & SHOOT) !== 0).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => ((await probe(page)).lastFrame.held & SHOOT) !== 0).toBe(false);
});

test('Esc closes only the Settings pop-up; the game stays paused', async ({ page }) => {
  await bootLevel(page);
  await openSettingsFromPause(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
  await expect(page.locator('[data-role="pause-overlay"]')).toBeVisible();
  expect((await probe(page)).paused).toBe(true);
  await expect(page.locator('[data-role="pause-overlay"] [data-action="settings"]')).toBeFocused();
});

test('text size scales the UI live', async ({ page }) => {
  await bootLevel(page);
  await openSettingsFromPause(page);
  const title = page.getByRole('heading', { name: 'Settings' });
  const before = await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.getByRole('tab', { name: 'Accessibility' }).click();
  const slider = page.getByRole('slider', { name: 'Text size' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('150');
  const after = await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(after / before).toBeCloseTo(1.5, 1);
});

test('the Title gear opens Settings; Esc closes it and focus returns to the gear', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?test=1&flow=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await page.evaluate(() => {
    localStorage.setItem('cd.photoNotice', '1');
  });
  await page.reload();
  await page.waitForSelector('[data-role="title"]');
  const gear = page.locator('[data-role="title"] [data-action="settings"]');
  await gear.click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await axe(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
  await expect(page.locator('[data-role="title"]')).toBeVisible();
  await expect(gear).toBeFocused();
  // Opening Settings never started the game.
  expect(await page.evaluate(() => window.__CD_TEST__?.sim() ?? null)).toBeNull();
});

test('phone size: Settings fits the screen and scrolls inside', async ({ page }) => {
  await bootLevel(page, { width: 844, height: 390 });
  await openSettingsFromPause(page);
  await settle(page);
  const box = await page.getByRole('dialog', { name: 'Settings' }).boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? -1) >= 0 && (box?.y ?? 0) + (box?.height ?? 9999) <= 390).toBe(true);
  expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 9999) <= 844).toBe(true);
  await page.getByRole('tab', { name: 'Controls' }).click();
  const scrolls = await page
    .locator('.cd-settings-panel')
    .evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto');
  expect(scrolls).toBe(true);
  await axe(page);
});
