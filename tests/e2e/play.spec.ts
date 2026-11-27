import { expect, test, type Page } from '@playwright/test';

/**
 * Pass 1D: the test arena is playable with keyboard, a standard gamepad, and multi-touch, and input
 * never sticks after a blur. Uses the read-only `?test=1` probe (`window.__CD_TEST__.sim()`).
 */

interface Probe {
  tick: number;
  paused: boolean;
  lastFrame: { moveX: number; moveY: number; held: number; aimMrad: number };
  players: { x: number; y: number; vx: number; vy: number; mode: string; grounded: boolean }[];
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const sim = window.__CD_TEST__?.sim();
    if (!sim) throw new Error('no running level');
    return JSON.parse(JSON.stringify(sim)) as Probe;
  });
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?test=1');
  await page.waitForSelector('#game-root[data-ready="true"]');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 10_000 }).toBeGreaterThan(5);
  return errors;
}

const JUMP_BIT = 1;

test('keyboard: run, jump, pause and resume', async ({ page }) => {
  const errors = await boot(page);
  const start = await probe(page);
  const x0 = start.players[0]?.x ?? 0;
  await page.keyboard.down('KeyD');
  await expect
    .poll(async () => (await probe(page)).players[0]?.x ?? 0, { timeout: 10_000 })
    .toBeGreaterThan(x0 + 40);
  await page.keyboard.up('KeyD');

  await page.keyboard.down('Space');
  await expect.poll(async () => (await probe(page)).players[0]?.grounded, { timeout: 10_000 }).toBe(false);
  await page.keyboard.up('Space');
  await expect.poll(async () => (await probe(page)).players[0]?.grounded, { timeout: 10_000 }).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).paused).toBe(true);
  const pausedTick = (await probe(page)).tick;
  await page.waitForTimeout(300);
  expect((await probe(page)).tick).toBe(pausedTick);
  await expect(page.locator('[data-role="pause-overlay"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).tick, { timeout: 10_000 }).toBeGreaterThan(pausedTick);
  expect(errors).toEqual([]);
});

test('blur releases a held key and pauses; nothing moves until the key is pressed again', async ({
  page,
}) => {
  const errors = await boot(page);
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await probe(page)).lastFrame.moveX).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(async () => (await probe(page)).paused).toBe(true);
  await page.keyboard.press('KeyP'); // resume; D is still physically down but was released by the blur
  await expect.poll(async () => (await probe(page)).paused).toBe(false);
  await page.waitForTimeout(300);
  const after = await probe(page);
  expect(after.lastFrame.moveX).toBe(0);
  await page.keyboard.up('KeyD');
  expect(errors).toEqual([]);
});

test('a standard gamepad plays: stick moves, A jumps', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { buttons: new Array<number>(17).fill(0), axes: [0, 0, 0, 0] };
    (window as unknown as { __pad: typeof state }).__pad = state;
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => [
        {
          index: 0,
          id: 'Test Pad (STANDARD GAMEPAD)',
          connected: true,
          mapping: 'standard',
          buttons: state.buttons.map((v) => ({ pressed: v > 0.5, value: v })),
          axes: [...state.axes],
        },
      ],
    });
  });
  const errors = await boot(page);
  expect(await page.evaluate(() => window.__CD_TEST__?.gamepads())).toEqual(['Test Pad (STANDARD GAMEPAD)']);
  const x0 = (await probe(page)).players[0]?.x ?? 0;
  await page.evaluate(() => {
    (window as unknown as { __pad: { axes: number[] } }).__pad.axes[0] = 1;
  });
  await expect
    .poll(async () => (await probe(page)).players[0]?.x ?? 0, { timeout: 10_000 })
    .toBeGreaterThan(x0 + 40);
  await page.evaluate(() => {
    const pad = (window as unknown as { __pad: { axes: number[]; buttons: number[] } }).__pad;
    pad.axes[0] = 0;
    pad.buttons[0] = 1;
  });
  await expect.poll(async () => (await probe(page)).lastFrame.held & JUMP_BIT).toBe(JUMP_BIT);
  await expect.poll(async () => (await probe(page)).players[0]?.grounded, { timeout: 10_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('multi-touch', () => {
  test.use({ hasTouch: true });

  interface Point {
    readonly id: number;
    readonly x: number;
    readonly y: number;
  }

  async function points(
    page: Page,
  ): Promise<{ stick: { x: number; y: number }; jump: { x: number; y: number } }> {
    const box = await page.locator('#game-root canvas').boundingBox();
    const jump = await page.locator('[data-control="jump"]').boundingBox();
    if (!box || !jump) throw new Error('canvas or jump button missing');
    return {
      stick: { x: box.x + 150, y: box.y + box.height - 120 },
      jump: { x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 },
    };
  }

  test('real touches: stick and Jump at the same time, then release-all', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'driven through the Chrome DevTools Protocol');
    const errors = await boot(page);
    await expect(page.locator('[data-role="touch-controls"]')).toBeVisible();
    const { stick, jump } = await points(page);
    const cdp = await page.context().newCDPSession(page);
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: Point[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts] });

    const x0 = (await probe(page)).players[0]?.x ?? 0;
    await send('touchStart', [{ ...stick, id: 1 }]);
    await send('touchMove', [{ x: stick.x + 70, y: stick.y, id: 1 }]);
    await send('touchStart', [
      { x: stick.x + 70, y: stick.y, id: 1 },
      { ...jump, id: 2 },
    ]);
    await expect.poll(async () => (await probe(page)).lastFrame.held & JUMP_BIT).toBe(JUMP_BIT);
    await expect.poll(async () => (await probe(page)).lastFrame.moveX).toBeGreaterThan(0.9);
    await expect
      .poll(async () => (await probe(page)).players[0]?.x ?? 0, { timeout: 10_000 })
      .toBeGreaterThan(x0 + 40);
    // CDP: touchEnd carries no points and lifts every finger.
    await send('touchEnd', []);
    await expect
      .poll(async () => (await probe(page)).lastFrame)
      .toEqual(expect.objectContaining({ moveX: 0, moveY: 0, held: 0 }));
    expect(errors).toEqual([]);
  });

  test('lifting only the Jump finger keeps the stick moving', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebKit desktop has no TouchEvent constructor');
    const errors = await boot(page);
    const { stick, jump } = await points(page);
    // Exact per-finger events (CDP releases fingers by list position, not by id).
    const fire = (type: string, changed: Point[], down: Point[]) =>
      page.evaluate(
        ({ type, changed, down }) => {
          const canvas = document.querySelector('#game-root canvas');
          if (!canvas) throw new Error('no canvas');
          const make = (p: { id: number; x: number; y: number }): Touch =>
            new Touch({ identifier: p.id, target: canvas, clientX: p.x, clientY: p.y });
          canvas.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              cancelable: true,
              changedTouches: changed.map(make),
              touches: down.map(make),
              targetTouches: down.map(make),
            }),
          );
        },
        { type, changed: [...changed], down: [...down] },
      );

    const s0: Point = { ...stick, id: 11 };
    const s1: Point = { x: stick.x + 70, y: stick.y, id: 11 };
    const j: Point = { ...jump, id: 12 };
    await fire('touchstart', [s0], [s0]);
    await fire('touchmove', [s1], [s1]);
    await fire('touchstart', [j], [s1, j]);
    await expect.poll(async () => (await probe(page)).lastFrame.held & JUMP_BIT).toBe(JUMP_BIT);
    await fire('touchend', [j], [s1]);
    await expect.poll(async () => (await probe(page)).lastFrame.held & JUMP_BIT).toBe(0);
    expect((await probe(page)).lastFrame.moveX).toBeGreaterThan(0.9);
    await fire('touchcancel', [s1], []);
    await expect.poll(async () => (await probe(page)).lastFrame.moveX).toBe(0);
    expect(errors).toEqual([]);
  });
});
