import { expect, test, type Page, type TestInfo } from '@playwright/test';

/**
 * Pass 2B-2 (spec 8.11): the en-XA pseudo-locale (accented, 35% longer, wrapped in ⟦…⟧) on every screen
 * at phone and desktop sizes. Any visible text without the marks was never translated (hard-coded); any
 * clipped or off-screen text is overflow. Each screen is attached as a screenshot to the report.
 */

interface Audit {
  readonly untranslated: string[];
  readonly overflow: string[];
}

/** Numbers, units, and symbols need no translation. */
const NEUTRAL = /^[\d\s.,:%·×+\-−/()~]*$|^II$|^v?\d+\.\d+\.\d+/;

async function audit(page: Page, scope: string): Promise<Audit> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  return page.evaluate(
    ({ scope, neutral }) => {
      const neutralRe = new RegExp(neutral);
      const untranslated: string[] = [];
      const overflow: string[] = [];
      const vw = window.innerWidth;
      const roots = [...document.querySelectorAll<HTMLElement>(scope)];
      const describe = (el: Element): string =>
        `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0] ?? ''}` : ''}`;
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = (node.textContent ?? '').trim();
          const el = node.parentElement;
          if (!text || !el) continue;
          const style = getComputedStyle(el);
          if (
            style.visibility === 'hidden' ||
            style.display === 'none' ||
            el.closest('[aria-hidden="true"]:not(.cd-logo)')
          )
            continue;
          if (el.getClientRects().length === 0) continue;
          if (!neutralRe.test(text) && !text.includes('⟦') && !text.includes('⟧')) untranslated.push(text);
          // Inside a sideways-scrolling strip (the tab list), the strip's box is what must fit; items
          // scrolled out of view inside it are reachable by scrolling, not overflow.
          let scroller: HTMLElement | null = el.parentElement;
          while (scroller && scroller !== root) {
            const ox = getComputedStyle(scroller).overflowX;
            if (ox === 'auto' || ox === 'scroll') break;
            scroller = scroller.parentElement;
          }
          const rect = (scroller && scroller !== root ? scroller : el).getBoundingClientRect();
          if (rect.left < -1 || rect.right > vw + 1)
            overflow.push(`${describe(el)} off-screen: ${text.slice(0, 40)}`);
          // Clipped text: content wider than its box in an element that hides overflow.
          let box: HTMLElement | null = el;
          while (box && box !== root.parentElement) {
            const s = getComputedStyle(box);
            const clips = s.overflowX === 'hidden' || s.overflowX === 'clip' || s.textOverflow === 'ellipsis';
            if (clips && box.scrollWidth > box.clientWidth + 1) {
              overflow.push(`${describe(box)} clips: ${text.slice(0, 40)}`);
              break;
            }
            box = box.parentElement;
          }
          // Text must stay inside its panel.
          const panel = el.closest('.cd-panel');
          if (panel) {
            const p = panel.getBoundingClientRect();
            if (rect.right > p.right + 1 || rect.left < p.left - 1)
              overflow.push(`${describe(el)} outside its panel: ${text.slice(0, 40)}`);
          }
        }
      }
      return { untranslated: [...new Set(untranslated)], overflow: [...new Set(overflow)] };
    },
    { scope, neutral: NEUTRAL.source },
  );
}

async function check(page: Page, info: TestInfo, name: string, scope = '.cd-ui'): Promise<void> {
  const result = await audit(page, scope);
  // Saved under test-results/ (CI uploads it as the `reports` artifact) and attached to the report.
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(`${name}.png`, { path, contentType: 'image/png' });
  expect(result.untranslated, `${name}: hard-coded text`).toEqual([]);
  expect(result.overflow, `${name}: overflow`).toEqual([]);
}

const SIZES = [
  { name: 'phone', width: 844, height: 390 },
  { name: 'desktop', width: 1280, height: 720 },
] as const;

for (const size of SIZES) {
  test.describe(`en-XA at ${size.name} size`, () => {
    // A touch device, so the on-screen controls (and their labels) are built too.
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

    test('notice and title', async ({ page }, info) => {
      await page.goto('/?test=1&flow=1&lang=en-XA');
      await page.waitForSelector('[data-role="photosensitivity-notice"]');
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('en-XA');
      await check(page, info, `${size.name}-notice`);
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-role="title"]');
      await expect(page.locator('[data-role="transition"]')).toHaveCount(0);
      await check(page, info, `${size.name}-title`);
    });

    test('pause, quit confirmation, and every settings tab', async ({ page }, info) => {
      test.setTimeout(120_000);
      await page.goto('/?test=1&lang=en-XA');
      await page.waitForSelector('#game-root[data-ready="true"]');
      await expect
        .poll(() => page.evaluate(() => window.__CD_TEST__?.sim()?.tick ?? 0), { timeout: 10_000 })
        .toBeGreaterThan(5);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-role="pause-overlay"]');
      await check(page, info, `${size.name}-pause`);
      await page.locator('[data-role="pause-overlay"] [data-action="quit"]').click();
      await page.waitForSelector('[role="alertdialog"]');
      await check(page, info, `${size.name}-quit`);
      await page.keyboard.press('Escape');
      await page.locator('[data-role="pause-overlay"] [data-action="settings"]').click();
      await page.waitForSelector('[data-screen="settings"]');
      const tabs = page.locator('[data-screen="settings"] [role="tab"]');
      const count = await tabs.count();
      expect(count).toBe(8);
      for (let i = 0; i < count; i += 1) {
        await tabs.nth(i).click();
        await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
        // Every row of the tab, not only the part in view.
        const panel = page.locator('.cd-settings-panel');
        const height = await panel.evaluate((el) => el.scrollHeight);
        for (let y = 0; y <= height; y += 300) {
          await panel.evaluate((el, top) => {
            el.scrollTop = top;
          }, y);
          await check(page, info, `${size.name}-settings-${String(i)}-${String(y)}`);
        }
      }
    });

    test('error panel and the touch controls', async ({ page }, info) => {
      await page.goto('/?test=1&lang=en-XA');
      await page.waitForSelector('#game-root[data-ready="true"]');
      await expect
        .poll(() => page.evaluate(() => window.__CD_TEST__?.sim()?.tick ?? 0), { timeout: 10_000 })
        .toBeGreaterThan(5);
      await page.evaluate(() => {
        window.__CD_TEST__?.crash();
      });
      await page.waitForSelector('[data-role="error-panel"]');
      await check(page, info, `${size.name}-error`, '[data-role="error-panel"]');
      await page.locator('[data-role="error-panel"] [data-action="restart"]').click();
      // Touch labels are translated too (shown once a finger lands).
      const labels = await page.locator('[data-role="touch-controls"] [data-label]').allTextContents();
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) if (label !== 'II') expect(label).toContain('⟦');
    });
  });
}

test('no graphics screen in en-XA', async ({ page }, info) => {
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
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?test=1&lang=en-XA');
  await page.waitForSelector('#webgl-required');
  await check(page, info, 'webgl', '#webgl-required');
});

test('the audit itself flags English text and clipped text', async ({ page }) => {
  await page.goto('/?test=1&flow=1');
  await page.waitForSelector('[data-role="photosensitivity-notice"]');
  const english = await audit(page, '.cd-ui');
  expect(english.untranslated.length).toBeGreaterThan(2);
  await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>('[data-action="continue"]');
    if (b) Object.assign(b.style, { width: '40px', overflow: 'hidden', whiteSpace: 'nowrap' });
  });
  const clipped = await audit(page, '.cd-ui');
  expect(clipped.overflow.some((o) => o.includes('clips'))).toBe(true);
});
