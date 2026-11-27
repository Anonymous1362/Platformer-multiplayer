import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 2A: the DOM UI layer. First-launch flow (photosensitivity notice, Title, Start), the Preact pause
 * screen with its quit confirmation, the dev gallery, axe on every screen, reduced-motion variants, and
 * transitions without long tasks.
 */

async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
}

async function axe(page: Page): Promise<void> {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary).toEqual([]);
}

async function probeTick(page: Page): Promise<number> {
  return page.evaluate(() => window.__CD_TEST__?.sim()?.tick ?? -1);
}

async function startFlow(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?test=1&flow=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  return errors;
}

async function markNoticeSeen(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('cd.photoNotice', '1');
  });
}

test('first launch: notice, then Title, then Start plays the level; the notice is not shown again', async ({
  page,
}) => {
  const errors = await startFlow(page);
  const notice = page.locator('[data-role="photosensitivity-notice"]');
  await expect(notice).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Photosensitivity notice' })).toBeVisible();
  await expect(page.locator('[data-action="continue"]')).toBeFocused();
  await axe(page);

  await page.keyboard.press('Enter');
  const title = page.locator('[data-role="title"]');
  await expect(title).toBeVisible();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('[data-role="version"]')).toHaveText(/^v\d+\.\d+\.\d+/);
  await expect(page.locator('[data-action="start"]')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('cd.photoNotice'))).toBe('1');
  await axe(page);
  // The level is not running behind the title.
  expect(await probeTick(page)).toBe(-1);

  await page.keyboard.press('Enter');
  await expect.poll(() => probeTick(page), { timeout: 15_000 }).toBeGreaterThan(5);
  await expect(title).toHaveCount(0);

  await page.reload();
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect(page.locator('[data-role="title"]')).toBeVisible();
  await expect(page.locator('[data-role="photosensitivity-notice"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Title: a click anywhere starts; Esc does nothing there', async ({ page }) => {
  const errors = await startFlow(page);
  await markNoticeSeen(page);
  await page.reload();
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect(page.locator('[data-role="title"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-role="title"]')).toBeVisible();
  await page.mouse.click(300, 200);
  await expect.poll(() => probeTick(page), { timeout: 15_000 }).toBeGreaterThan(5);
  // Esc pressed on the title must not leave the level paused.
  expect(await page.evaluate(() => window.__CD_TEST__?.sim()?.paused)).toBe(false);
  expect(errors).toEqual([]);
});

test('pause screen: axe, quit asks first, Cancel keeps the level, Quit returns to the Title', async ({
  page,
}) => {
  const errors = await startFlow(page);
  await markNoticeSeen(page);
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect.poll(() => probeTick(page)).toBeGreaterThan(5);
  await page.keyboard.press('Escape');
  const menu = page.locator('[data-role="pause-overlay"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-action="resume"]')).toBeFocused();
  await axe(page);

  await menu.locator('[data-action="quit"]').click();
  const dialog = page.getByRole('alertdialog', { name: 'Quit to title?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused(); // never default to the destructive choice
  await axe(page);
  // Escape closes the dialog only; the game stays paused behind the menu.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeVisible();
  expect(await page.evaluate(() => window.__CD_TEST__?.sim()?.paused)).toBe(true);
  // The Quit button is focused again after the dialog closes.
  await expect(menu.locator('[data-action="quit"]')).toBeFocused();

  await menu.locator('[data-action="quit"]').click();
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await expect(page.locator('[data-role="title"]')).toBeVisible({ timeout: 10_000 });
  expect(await probeTick(page)).toBe(-1);
  // And Start works again from there.
  await page.keyboard.press('Enter');
  await expect.poll(() => probeTick(page), { timeout: 15_000 }).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test('bundled fonts load from this origin (no font CDN)', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('http://localhost:4173') && !url.startsWith('blob:')) foreign.push(url);
  });
  await startFlow(page);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      exo: document.fonts.check('700 40px "Exo 2"'),
      inter: document.fonts.check('600 18px Inter'),
    };
  });
  expect(loaded.exo).toBe(true);
  expect(loaded.inter).toBe(true);
  expect(foreign).toEqual([]);
});

test.describe('gallery (dev only)', () => {
  test('is available only with debug=1', async ({ page }) => {
    await page.goto('/?gallery=1&test=1');
    await page.waitForSelector('#game-root[data-ready="true"]');
    await expect(page.locator('[data-role="gallery"]')).toHaveCount(0);
  });

  test('every component and screen passes axe', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?debug=1&gallery=1');
    await page.waitForSelector('body[data-gallery="ready"]');
    await expect(page.locator('[data-role="gallery"]')).toBeVisible();
    await axe(page);
    expect(errors).toEqual([]);
  });

  test('open overlays pass axe, trap Tab, close on Escape, and give focus back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?debug=1&gallery=1');
    await page.waitForSelector('body[data-gallery="ready"]');
    const open = page.getByRole('button', { name: 'Open modal' });
    await open.click();
    const modal = page.getByRole('dialog', { name: 'Example modal' });
    await expect(modal).toBeVisible();
    await axe(page);
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab');
    expect(await modal.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(open).toBeFocused();

    await page.getByRole('button', { name: 'Open side sheet' }).click();
    await expect(page.getByRole('dialog', { name: 'Workshop' })).toBeVisible();
    await axe(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Workshop' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Toast', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveCount(0, { timeout: 5000 });
  });

  test('controls work from the keyboard: toggle, segmented, tabs, slider, stepper, code input', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?debug=1&gallery=1');
    await page.waitForSelector('body[data-gallery="ready"]');
    const toggle = page.getByRole('switch', { name: 'Screen shake' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    const hard = page.getByRole('radio', { name: 'Hard' });
    await page.getByRole('radio', { name: 'Normal' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(hard).toHaveAttribute('aria-checked', 'true');

    const gadgets = page.getByRole('tab', { name: 'Gadgets' });
    await page.getByRole('tab', { name: 'Weapons' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(gadgets).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('Second tab panel');

    const slider = page.getByRole('slider', { name: 'Master volume' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('71');

    const players = page.getByRole('group', { name: 'Players' }).locator('output');
    await expect(players).toHaveText('3');
    await page.getByRole('button', { name: 'Increase Players' }).click();
    await expect(players).toHaveText('4');
    await expect(page.getByRole('button', { name: 'Increase Players' })).toBeDisabled();

    await page.getByRole('textbox', { name: /Room code character 1/ }).focus();
    await page.keyboard.type('ab3');
    await expect(page.getByRole('textbox', { name: /Room code character 3/ })).toHaveValue('3');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(page.getByRole('textbox', { name: /Room code character 2/ })).toBeFocused();
  });

  test('transitions run without long tasks', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?debug=1&gallery=1');
    await page.waitForSelector('body[data-gallery="ready"]');
    await page.evaluate(() => {
      const w = window as unknown as { __long: number[] };
      w.__long = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push(e.duration);
      }).observe({ entryTypes: ['longtask'] });
    });
    for (const action of ['demo-fade', 'demo-iris']) {
      await page.locator(`[data-action="${action}"]`).click();
      const overlay = page.locator('[data-role="transition"]');
      await expect(overlay).toHaveCount(1);
      await expect(overlay).toHaveCount(0, { timeout: 3000 });
    }
    const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
    expect(long.filter((d) => d > 100)).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the pause panel animates opacity only', async ({ page }) => {
    await startFlow(page);
    await markNoticeSeen(page);
    await page.goto('/?test=1');
    await page.waitForSelector('#game-root[data-ready="true"]');
    await expect.poll(() => probeTick(page)).toBeGreaterThan(5);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-role="pause-overlay"]')).toBeVisible();
    const props = await page.evaluate(() => {
      const names = new Set<string>();
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        const target = effect?.target;
        if (!effect || !(target instanceof Element) || !target.closest('.cd-ui')) continue;
        for (const frame of effect.getKeyframes()) {
          for (const key of Object.keys(frame)) {
            if (!['offset', 'easing', 'composite', 'computedOffset'].includes(key)) names.add(key);
          }
        }
      }
      return [...names];
    });
    expect(props.filter((p) => p !== 'opacity')).toEqual([]);
    expect(await page.locator('.cd-ui').getAttribute('data-motion')).toBe('reduced');
  });

  test('the gallery iris uses no disc', async ({ page }) => {
    await page.goto('/?debug=1&gallery=1');
    await page.waitForSelector('body[data-gallery="ready"]');
    await page.locator('[data-action="demo-iris"]').click();
    await expect(page.locator('[data-role="transition"]')).toHaveCount(1);
    await expect(page.locator('.cd-transition-disc')).toHaveCount(0);
    await expect(page.locator('[data-role="transition"]')).toHaveCount(0, { timeout: 3000 });
  });
});

test('phone size: the notice fits the screen and its button is at least 48 px tall', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?test=1&flow=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  const notice = page.locator('[data-role="photosensitivity-notice"] [role="dialog"]');
  await expect(notice).toBeVisible();
  const box = await notice.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? -1) >= 0 && (box?.y ?? 0) + (box?.height ?? 9999) <= 390).toBe(true);
  const button = await page.locator('[data-action="continue"]').boundingBox();
  expect(button?.height ?? 0).toBeGreaterThanOrEqual(48);
});
