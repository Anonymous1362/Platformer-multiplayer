import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 2B-3: colorblind palettes, the high-contrast HUD, and sound captions (spec 7.5, 8.6, 8.12, 9.2).
 * Settings are seeded through `localStorage['cd.settings']` (per-field fallback fills the rest).
 */

async function boot(
  page: Page,
  accessibility: Record<string, unknown> = {},
  audio: Record<string, unknown> = {},
): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await page.evaluate(
    ({ accessibility, audio }) => {
      localStorage.setItem('cd.settings', JSON.stringify({ version: 1, accessibility, audio }));
    },
    { accessibility, audio },
  );
  await page.reload();
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect
    .poll(() => page.evaluate(() => window.__CD_TEST__?.sim()?.tick ?? 0), { timeout: 10_000 })
    .toBeGreaterThan(5);
}

const cssVar = (page: Page, name: string): Promise<string> =>
  page.evaluate(
    (n) =>
      getComputedStyle(document.querySelector('.cd-ui') as HTMLElement)
        .getPropertyValue(n)
        .trim(),
    name,
  );

test('a colorblind palette swaps the UI tokens and the HUD colors live', async ({ page }) => {
  await boot(page);
  const shield = page.locator('[data-hud="shield"]');
  const before = await shield.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.keyboard.press('Escape');
  await page.locator('[data-role="pause-overlay"] [data-action="settings"]').click();
  await page.getByRole('tab', { name: 'Accessibility' }).click();
  await page.getByRole('radio', { name: 'Protanopia' }).click();
  await expect.poll(() => cssVar(page, '--danger')).toBe('#F25A78');
  expect(await cssVar(page, '--accent')).toBe('#66FFF0');
  const after = await shield.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(after).toBe('rgb(102, 255, 240)');
  expect(after).not.toBe(before);
  await page.getByRole('radio', { name: 'Off' }).first().click();
  await expect.poll(() => cssVar(page, '--danger')).toBe('#FF2A85');
});

test('high-contrast HUD: opaque, outlined HUD and opaque menus; axe still passes', async ({ page }) => {
  await boot(page, { highContrastHud: true });
  await expect(page.locator('[data-role="hud"]')).toHaveAttribute('data-contrast', 'high');
  await expect(page.locator('.cd-ui')).toHaveAttribute('data-contrast', 'high');
  const border = await page.locator('[data-hud="hp"]').evaluate((el) => getComputedStyle(el).borderTopWidth);
  expect(border).toBe('2px');
  await page.keyboard.press('Escape');
  await page.locator('[data-role="pause-overlay"] [data-action="settings"]').click();
  await page.getByRole('tab', { name: 'Accessibility' }).click();
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Owner decision 2026-11-27 (docs/DECISIONS.md): spec N14 keeps browser zoom off.
    .disableRules(['meta-viewport'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

async function walkUntilCaption(page: Page): Promise<string> {
  await page.keyboard.down('KeyD');
  const caption = page.locator('[data-role="captions"] [data-caption]').first();
  try {
    await expect(caption).toBeVisible({ timeout: 20_000 });
  } finally {
    await page.keyboard.up('KeyD');
  }
  return (await caption.textContent()) ?? '';
}

test('captions show the Crawler alert, even with the game muted', async ({ page }) => {
  await boot(page, {}, { master: 0 });
  const text = await walkUntilCaption(page);
  expect(text).toMatch(/Crawler/);
  await expect(page.locator('[data-role="captions"]')).toHaveAttribute('aria-live', 'polite');
});

test('turning captions off hides a caption that is showing', async ({ page }) => {
  await boot(page);
  await walkUntilCaption(page);
  await page.keyboard.press('Escape');
  await page.locator('[data-role="pause-overlay"] [data-action="settings"]').click();
  await page.getByRole('tab', { name: 'Accessibility' }).click();
  await page.getByRole('switch', { name: 'Sound captions' }).click();
  await expect(page.locator('[data-role="captions"] [data-caption]')).toHaveCount(0);
});
