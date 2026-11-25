import { expect, test, type Page } from '@playwright/test';

type AssetSnapshot = Record<string, { status: string; source: string; reason: string | null }>;

async function snapshot(page: Page): Promise<AssetSnapshot> {
  return page.evaluate(() => {
    const hooks = window.__CD_TEST__;
    if (!hooks) throw new Error('test hooks missing');
    return hooks.assets();
  });
}

function watch(page: Page): { failures: string[]; errors: string[]; warnings: string[] } {
  const record = { failures: [] as string[], errors: [] as string[], warnings: [] as string[] };
  page.on('response', (r) => {
    if (r.status() >= 400) record.failures.push(`${String(r.status())} ${r.url()}`);
  });
  page.on('requestfailed', (r) => record.failures.push(`failed ${r.url()}`));
  page.on('pageerror', (e) => record.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'warning' && m.text().includes('[assets]')) record.warnings.push(m.text());
  });
  return record;
}

for (const vp of [
  { name: 'phone 19.5:9', width: 844, height: 390 },
  { name: 'desktop 16:9', width: 1280, height: 720 },
]) {
  test(`boots cleanly on ${vp.name} with zero failed requests`, async ({ page }) => {
    const seen = watch(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/?test=1');
    await page.waitForSelector('#game-root[data-ready="true"]');

    expect(await snapshot(page)).toEqual({
      bg_starfield: { status: 'loaded', source: 'custom', reason: null },
      fx_soft_dot: { status: 'procedural', source: 'procedural', reason: null },
    });
    expect(seen.failures).toEqual([]);
    expect(seen.errors).toEqual([]);
    expect(seen.warnings).toEqual([]);
  });
}

test('a stalled asset falls back within the timeout and warns once', async ({ page }) => {
  const seen = watch(page);
  // Never answer: the request hangs, so only the game's 1500 ms per-file timer can settle it.
  await page.route('**/assets/global/bg_starfield.png', () => undefined);
  const started = Date.now();
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]', { timeout: 10_000 });
  const elapsedMs = Date.now() - started;

  expect((await snapshot(page))['bg_starfield']).toEqual({
    status: 'fallback',
    source: 'custom',
    reason: 'timeout',
  });
  expect(elapsedMs).toBeLessThan(5000);
  expect(seen.warnings).toHaveLength(1);
  expect(seen.errors).toEqual([]);
});

test('a missing asset (404) falls back without errors', async ({ page }) => {
  const seen = watch(page);
  await page.route('**/assets/global/bg_starfield.png', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  expect((await snapshot(page))['bg_starfield']?.status).toBe('fallback');
  expect(seen.errors).toEqual([]);
});

test('a corrupt image falls back without errors', async ({ page }) => {
  const seen = watch(page);
  await page.route('**/assets/global/bg_starfield.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('not really a png') }),
  );
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  expect((await snapshot(page))['bg_starfield']).toEqual({
    status: 'fallback',
    source: 'custom',
    reason: 'not-loaded',
  });
  expect(seen.errors).toEqual([]);
});

test('a broken manifest still boots with procedural textures', async ({ page }) => {
  const seen = watch(page);
  await page.route('**/assets/ASSET_MANIFEST.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"schemaVersion":1,"entries":"oops"}',
    }),
  );
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  const snap = await snapshot(page);
  expect(snap['bg_starfield']?.reason).toBe('not-in-manifest');
  expect(seen.errors).toEqual([]);
});

test('shows the WebGL-required screen when WebGL is unavailable', async ({ page }) => {
  const seen = watch(page);
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
    const original = proto.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...rest: unknown[]): unknown {
        if (type.toLowerCase().includes('webgl')) return null;
        return original.call(this, type, ...rest);
      },
    });
  });
  await page.goto('/?test=1');
  const screen = page.locator('#webgl-required');
  await expect(screen).toBeVisible();
  await expect(screen.getByRole('heading')).toHaveText('Graphics are not available');
  await expect(screen.getByRole('button', { name: 'Try again' })).toBeFocused();
  await expect(page.locator('#game-root canvas')).toHaveCount(0);
  expect(seen.errors).toEqual([]);
});

test('debug badge shows FPS and frame times', async ({ page }) => {
  await page.goto('/?test=1&debug=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect(page.locator('#perf-badge')).toHaveText(/^\d+ fps · \d+\.\d ms · p95 \d+\.\d ms$/, {
    timeout: 5000,
  });
});

test('viewport guards block browser zoom gestures', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  const result = await page.evaluate(() => {
    const wheel = new WheelEvent('wheel', { ctrlKey: true, cancelable: true, bubbles: true });
    window.dispatchEvent(wheel);
    const dbl = new MouseEvent('dblclick', { cancelable: true, bubbles: true });
    document.dispatchEvent(dbl);
    const zoomKey = new KeyboardEvent('keydown', {
      key: '+',
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    window.dispatchEvent(zoomKey);
    const plainWheel = new WheelEvent('wheel', { cancelable: true, bubbles: true });
    window.dispatchEvent(plainWheel);
    return {
      wheel: wheel.defaultPrevented,
      dbl: dbl.defaultPrevented,
      zoomKey: zoomKey.defaultPrevented,
      plainWheel: plainWheel.defaultPrevented,
      touchAction: getComputedStyle(document.body).touchAction,
    };
  });
  expect(result).toEqual({ wheel: true, dbl: true, zoomKey: true, plainWheel: false, touchAction: 'none' });
});
