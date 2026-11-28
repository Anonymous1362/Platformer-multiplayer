import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 2B-5 (spec 8.13): keyboard and controller rebinding with conflict flags and Reset to defaults,
 * stored per device; menus usable with a controller (D-pad, A, B, bumpers).
 */

const JUMP = 1 << 0;

async function sim(page: Page): Promise<{ tick: number; paused: boolean; held: number }> {
  return page.evaluate(() => {
    const s = window.__CD_TEST__?.sim();
    return { tick: s?.tick ?? 0, paused: s?.paused ?? false, held: s?.lastFrame.held ?? 0 };
  });
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect.poll(async () => (await sim(page)).tick, { timeout: 10_000 }).toBeGreaterThan(5);
}

async function openBindings(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.locator('[data-role="pause-overlay"] [data-action="settings"]').click();
  await page.getByRole('tab', { name: 'Controls' }).click();
  await page.locator('[data-action="rebind"]').click();
  await expect(page.locator('[data-screen="bindings"]')).toBeVisible();
}

const slot = (page: Page, id: string) => page.locator(`[data-binding="${id}"]`);

test('rebind Jump to J: J jumps, Space no longer does, and it survives a reload', async ({ page }) => {
  await boot(page);
  await openBindings(page);
  await slot(page, 'key:jump:0').click();
  await expect(slot(page, 'key:jump:0')).toHaveText('Press a key…');
  await page.keyboard.press('KeyJ');
  await expect(slot(page, 'key:jump:0')).toHaveText('J');
  await page.locator('[data-action="close-bindings"]').click();
  await page.locator('[data-action="close-settings"]').click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await sim(page)).paused).toBe(false);

  await page.keyboard.down('KeyJ');
  await expect.poll(async () => (await sim(page)).held & JUMP).toBe(JUMP);
  await page.keyboard.up('KeyJ');
  await expect.poll(async () => (await sim(page)).held & JUMP).toBe(0);
  await page.keyboard.down('Space');
  await page.waitForTimeout(300);
  expect((await sim(page)).held & JUMP).toBe(0);
  await page.keyboard.up('Space');

  await page.reload();
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect.poll(async () => (await sim(page)).tick, { timeout: 10_000 }).toBeGreaterThan(5);
  await page.keyboard.down('KeyJ');
  await expect.poll(async () => (await sim(page)).held & JUMP).toBe(JUMP);
  await page.keyboard.up('KeyJ');
});

test('a conflict is flagged on both actions; Esc cancels a capture; Reset to defaults restores', async ({
  page,
}) => {
  await boot(page);
  await openBindings(page);
  await slot(page, 'key:dash:1').click();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-conflict="dash"]')).toContainText('Jump');
  await expect(page.locator('[data-conflict="jump"]')).toContainText('Dash');
  // Esc while capturing cancels that capture only.
  await slot(page, 'key:parry:1').click();
  await page.keyboard.press('Escape');
  await expect(slot(page, 'key:parry:1')).toHaveText('Not set');
  await expect(page.locator('[data-screen="bindings"]')).toBeVisible();
  // Backspace clears a slot.
  await slot(page, 'key:gadget:1').click();
  await page.keyboard.press('Backspace');
  await expect(slot(page, 'key:gadget:1')).toHaveText('Not set');

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

  await page.locator('[data-action="reset-keys"]').click();
  await expect(page.locator('[data-conflict]')).toHaveCount(0);
  await expect(slot(page, 'key:dash:1')).toHaveText('C');
  await expect(slot(page, 'key:gadget:1')).toHaveText('B');
});

test.describe('with a controller', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const state = { buttons: new Array<number>(17).fill(0), axes: [0, 0, 0, 0] };
      (window as unknown as { __pad: typeof state }).__pad = state;
      Object.defineProperty(navigator, 'getGamepads', {
        value: () => [
          {
            index: 0,
            id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
            connected: true,
            mapping: 'standard',
            buttons: state.buttons.map((v) => ({ pressed: v > 0.5, value: v })),
            axes: [...state.axes],
          },
        ],
      });
    });
  });

  /** Press and release one button, a few frames apart (the game polls once per frame). */
  async function tap(page: Page, button: number): Promise<void> {
    await page.evaluate((b) => {
      (window as unknown as { __pad: { buttons: number[] } }).__pad.buttons[b] = 1;
    }, button);
    await page.waitForTimeout(120);
    await page.evaluate((b) => {
      (window as unknown as { __pad: { buttons: number[] } }).__pad.buttons[b] = 0;
    }, button);
    await page.waitForTimeout(120);
  }

  test('rebind Jump to Y with the controller; Y then jumps', async ({ page }) => {
    await boot(page);
    await openBindings(page);
    await expect(page.getByRole('tab', { name: 'Controller' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-screen="bindings"]')).toContainText('Connected: Xbox');
    await slot(page, 'pad:jump:0').click();
    await expect(slot(page, 'pad:jump:0')).toHaveText('Press a button…');
    await tap(page, 3);
    await expect(slot(page, 'pad:jump:0')).toHaveText('Y');
    await page.locator('[data-action="close-bindings"]').click();
    await page.locator('[data-action="close-settings"]').click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await sim(page)).paused).toBe(false);
    await page.evaluate(() => {
      (window as unknown as { __pad: { buttons: number[] } }).__pad.buttons[3] = 1;
    });
    await expect.poll(async () => (await sim(page)).held & JUMP).toBe(JUMP);
  });

  test('menus with the controller: D-pad, A, bumpers switch tabs, D-pad right moves a slider, B backs out', async ({
    page,
  }) => {
    await boot(page);
    await tap(page, 9); // Start pauses
    await expect(page.locator('[data-role="pause-overlay"]')).toBeVisible();
    await tap(page, 13); // D-pad down: Restart
    await tap(page, 13); // Settings
    await expect(page.locator('[data-role="pause-overlay"] [data-action="settings"]')).toBeFocused();
    await tap(page, 0); // A
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await tap(page, 5); // RB: next tab
    await expect(page.getByRole('tab', { name: 'Graphics' })).toHaveAttribute('aria-selected', 'true');
    await tap(page, 4); // LB: back to Audio
    await expect(page.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true');
    const master = page.getByRole('slider', { name: 'Master volume' });
    await master.focus();
    await tap(page, 15); // D-pad right
    await expect(master).toHaveValue('81');
    await tap(page, 1); // B closes Settings
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
    await expect(page.locator('[data-role="pause-overlay"]')).toBeVisible();
    expect(await page.evaluate(() => window.__CD_TEST__?.settings().audio.master)).toBe(81);
  });
});
