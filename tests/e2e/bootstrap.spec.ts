import { expect, test } from '@playwright/test';

const viewports = [
  { name: '16:9', width: 1280, height: 720 },
  { name: '19.5:9', width: 1560, height: 720 },
  { name: '4:3', width: 960, height: 720 },
] as const;

test('boots a responsive Phaser scene with guarded touch and viewport behavior', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Cosmic Drift');
  await expect(page.locator('#game')).toHaveAttribute('data-webgl', 'true');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  );

  const canvas = page.locator('#game-stage canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', 'Cosmic Drift title screen artwork');
  await expect
    .poll(() =>
      canvas.evaluate((element) => (element instanceof HTMLCanvasElement ? element.width : 0)),
    )
    .toBe(1920);

  const touchAction = await page
    .locator('#game-stage')
    .evaluate((element) => getComputedStyle(element).touchAction);
  expect(touchAction).toBe('none');

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const bounds = await canvas.boundingBox();

    expect(bounds, `${viewport.name} canvas should have a visible layout box`).not.toBeNull();
    if (bounds === null) {
      throw new Error(`${viewport.name} canvas has no layout box.`);
    }

    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(bounds.width / bounds.height).toBeCloseTo(viewport.width / viewport.height, 2);
  }

  expect(failedResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('shows an accessible WebGL-required screen when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => null,
    });
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Cosmic Drift needs WebGL' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('try a device with WebGL enabled');
  await expect(page.locator('#game-stage canvas')).toHaveCount(0);
});
