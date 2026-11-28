import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 2B-4 (spec 8.8): touch presets and the layout editor. "Edited layouts survive restarts":
 * drag a control, save, reload the page, and it is still there; Reset to preset brings it back.
 */

test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

interface Button {
  role: string;
  cx: number;
  cy: number;
  radius: number;
}

async function buttons(page: Page): Promise<Button[]> {
  return page.evaluate(
    () => JSON.parse(JSON.stringify(window.__CD_TEST__?.touchLayout().buttons ?? [])) as Button[],
  );
}

const find = async (page: Page, role: string): Promise<Button | undefined> =>
  (await buttons(page)).find((b) => b.role === role);

async function boot(page: Page): Promise<void> {
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect
    .poll(() => page.evaluate(() => window.__CD_TEST__?.sim()?.tick ?? 0), { timeout: 10_000 })
    .toBeGreaterThan(5);
}

async function openControls(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.locator('[data-role="pause-overlay"] [data-action="settings"]').click();
  await page.getByRole('tab', { name: 'Controls' }).click();
}

async function openEditor(page: Page): Promise<void> {
  await openControls(page);
  await page.locator('[data-action="edit-layout"]').click();
  await expect(page.locator('[data-screen="layout-editor"]')).toBeVisible();
}

test('a dragged control is saved, survives a reload, and Reset to preset restores it', async ({ page }) => {
  await boot(page);
  const before = await find(page, 'jump');
  expect(before).toBeDefined();
  await openEditor(page);
  const control = page.locator('[data-screen="layout-editor"] [data-control="jump"]');
  const box = await control.boundingBox();
  if (!box) throw new Error('no jump control');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  await page.locator('[data-action="save-layout"]').click();
  await expect(page.locator('[data-screen="layout-editor"]')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible(); // back on Controls
  await expect(page.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true');
  const moved = await find(page, 'jump');
  expect(Math.round(moved?.cx ?? 0)).toBe(Math.round((before?.cx ?? 0) - 150));
  expect(Math.round(moved?.cy ?? 0)).toBe(Math.round((before?.cy ?? 0) - 60));

  await page.reload();
  await page.waitForSelector('#game-root[data-ready="true"]');
  const afterReload = await find(page, 'jump');
  expect(Math.round(afterReload?.cx ?? 0)).toBe(Math.round(moved?.cx ?? 0));
  expect(Math.round(afterReload?.cy ?? 0)).toBe(Math.round(moved?.cy ?? 0));

  await expect
    .poll(() => page.evaluate(() => window.__CD_TEST__?.sim()?.tick ?? 0), { timeout: 10_000 })
    .toBeGreaterThan(5);
  await openEditor(page);
  await page.locator('[data-action="reset-layout"]').click();
  await page.locator('[data-action="save-layout"]').click();
  const reset = await find(page, 'jump');
  expect(Math.round(reset?.cx ?? 0)).toBe(Math.round(before?.cx ?? 0));
});

test('resize a control; arrow keys nudge it; Esc cancels without saving; axe passes', async ({ page }) => {
  await boot(page);
  const before = await find(page, 'dash');
  await openEditor(page);
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Owner decision 2026-11-27 (docs/DECISIONS.md): spec N14 keeps browser zoom off.
    .disableRules(['meta-viewport'])
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual(
    [],
  );

  const dash = page.locator('[data-screen="layout-editor"] [data-control="dash"]');
  await dash.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const size = page.getByRole('slider', { name: 'Dash size' });
  await size.focus();
  await page.keyboard.press('End');
  await expect(size).toHaveValue('150');
  await page.locator('[data-action="save-layout"]').click();
  const edited = await find(page, 'dash');
  expect(Math.round(edited?.cx ?? 0)).toBe(Math.round((before?.cx ?? 0) - 16));
  expect(edited?.radius).toBeCloseTo((before?.radius ?? 0) * 1.5);

  // Esc closes the editor without saving, and the game stays paused.
  await page.locator('[data-action="edit-layout"]').click();
  await dash.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="layout-editor"]')).toHaveCount(0);
  expect(Math.round((await find(page, 'dash'))?.cy ?? 0)).toBe(Math.round(edited?.cy ?? 0));
  expect(await page.evaluate(() => window.__CD_TEST__?.sim()?.paused)).toBe(true);
});

test('presets: Left-handed mirrors the controls; Simple hides Fire and auto-fires', async ({ page }) => {
  await boot(page);
  await openControls(page);
  await page.getByRole('radio', { name: 'Left-handed' }).click();
  expect((await find(page, 'jump'))?.cx).toBe(88);
  await page.getByRole('radio', { name: 'Simple' }).click();
  expect(await find(page, 'shoot')).toBeUndefined();
  await page.locator('[data-action="close-settings"]').click();
  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => ((window.__CD_TEST__?.sim()?.lastFrame.held ?? 0) & (1 << 2)) !== 0))
    .toBe(true);
});
