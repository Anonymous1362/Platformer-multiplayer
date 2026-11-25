import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { computeStageSize } from '../../src/app/Viewport';

const viewports = [
  { name: '16:9', width: 1920, height: 1080 },
  { name: '19.5:9', width: 2340, height: 1080 },
  { name: '4:3', width: 1600, height: 1200 },
  { name: 'wider than 21:9 (pillarbox)', width: 3440, height: 1080 },
  { name: 'narrower than 4:3 (letterbox)', width: 800, height: 1000 },
] as const;

for (const vp of viewports) {
  test(`canvas fits and renders at ${vp.name} (${String(vp.width)}x${String(vp.height)})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/?test=1');
    await page.waitForSelector('#game-root[data-ready="true"]');

    const expected = computeStageSize(vp.width, vp.height);
    const box = await page.locator('#game-root canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box?.width ?? 0)).toBe(expected.width);
    expect(Math.round(box?.height ?? 0)).toBe(expected.height);

    // Not blank: the fallback background must contain visible variation.
    const png = await page.locator('#game-root').screenshot();
    const stats = await sharp(png).stats();
    const spread = stats.channels.reduce((sum, c) => sum + c.stdev, 0);
    expect(spread).toBeGreaterThan(8);

    expect(errors).toEqual([]);
  });
}

test('stage resizes when the window changes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');

  await page.setViewportSize({ width: 1600, height: 1200 });
  const expected = computeStageSize(1600, 1200);
  await expect
    .poll(async () => {
      const box = await page.locator('#game-root canvas').boundingBox();
      return `${String(Math.round(box?.width ?? 0))}x${String(Math.round(box?.height ?? 0))}`;
    })
    .toBe(`${String(expected.width)}x${String(expected.height)}`);
});
