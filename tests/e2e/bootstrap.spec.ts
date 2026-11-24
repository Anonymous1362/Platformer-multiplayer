import { expect, test } from '@playwright/test';

const viewports = [
  { name: '16:9', width: 1280, height: 720 },
  { name: '19.5:9', width: 1560, height: 720 },
  { name: '4:3', width: 960, height: 720 },
] as const;

test('renders a responsive Phaser canvas with the fallback scene', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle('Cosmic Drift');

  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', 'Cosmic Drift title screen artwork');

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
    expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2);
  }

  expect(pageErrors).toEqual([]);
});
