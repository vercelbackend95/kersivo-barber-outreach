/**
 * Real-browser regressions for the marketing pages:
 * - wheel/trackpad scrolling over the desktop hero dashboard iframe moves only the landing page;
 * - the open mobile navigation is pinned to the viewport top and never moves the page.
 *
 * Run against a production build: BASE_URL=http://127.0.0.1:4329 npx playwright test --config=scripts/marketing-scroll-nav.playwright.config.mjs
 */
import { expect, test, type Browser, type BrowserContext, type Frame, type Page } from '@playwright/test';

const HERO_PAGES = ['/', '/fresha-alternative'];
const NAV_PAGES = ['/', '/fresha-alternative', '/booksy-alternative', '/barber-software-cost-calculator'];

/** The consent banner hydrates after load and would otherwise sit over part of the dashboard. */
async function dismissConsent(page: Page) {
  const reject = page.locator('.cookie-consent__btn--reject');
  const shown = await reject.waitFor({ state: 'visible', timeout: 10000 }).then(
    () => true,
    () => false,
  );
  if (!shown) return;
  await reject.click();
  await reject.waitFor({ state: 'hidden' });
}

async function openHero(browser: Browser, path: string, width: number): Promise<{ context: BrowserContext; page: Page; frame: Frame }> {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(path, { waitUntil: 'load' });
  await dismissConsent(page);
  await page.locator('.hero-showcase__viewport').scrollIntoViewIfNeeded();
  await page.waitForSelector('.hero-showcase__viewport[data-frame-state="ready"]', { timeout: 60000 });
  const frame = page.frames().find((f) => f.url().includes('embed=hero'));
  if (!frame) throw new Error('hero frame missing');
  // The timeline smooth-scrolls itself to "now" after load; wait until it has settled.
  let previous = -1;
  await expect
    .poll(
      async () => {
        const current = await frameScrollTotal(frame);
        const settled = current > 0 && current === previous;
        previous = current;
        return settled;
      },
      { timeout: 15000, intervals: [400] },
    )
    .toBe(true);
  return { context, page, frame };
}

/** Puts the dashboard near the top of the window and returns a point inside it. */
async function pointInsideDashboard(page: Page) {
  await page.evaluate(() => {
    const top = document.querySelector('.hero-showcase__viewport')!.getBoundingClientRect().top;
    window.scrollTo({ top: window.scrollY + top - 40, behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  const box = (await page.locator('.hero-showcase__viewport').boundingBox())!;
  return { x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 };
}

/**
 * A point over the visible part of the dashboard, without scrolling: near its top edge when scrolling down and
 * near its bottom edge when scrolling up, so the frame stays under the pointer while the page moves.
 */
async function pointOverVisibleDashboard(page: Page, direction: 1 | -1) {
  const box = (await page.locator('.hero-showcase__frame').boundingBox())!;
  const headerBottom = await page.evaluate(() => document.querySelector('[data-mnav]')!.getBoundingClientRect().bottom);
  const top = Math.max(box.y, headerBottom);
  const bottom = Math.min(box.y + box.height, page.viewportSize()!.height);
  if (bottom - top < 40) throw new Error('dashboard not visible enough to wheel over');
  return { x: box.x + box.width * 0.6, y: direction === 1 ? top + 20 : bottom - 20 };
}

/** Sum of every vertical scroll offset inside the frame (document and all elements). */
const frameScrollTotal = (frame: Frame) =>
  frame.evaluate(() => {
    let total = document.scrollingElement!.scrollTop;
    for (const el of document.querySelectorAll('body *')) total += el.scrollTop;
    return total;
  });

test.describe('desktop hero dashboard: one continuous page scroll', () => {
  for (const path of HERO_PAGES) {
    for (const width of [1024, 1440]) {
      test(`${path} @${width}: every wheel delta over the frame scrolls the page, never the frame`, async ({ browser }) => {
        const { context, page, frame } = await openHero(browser, path, width);
        const deltas = Array.from({ length: 48 }, (_, i) => (i % 3 === 0 ? 7 : 11));
        const total = deltas.reduce((a, b) => a + b, 0);

        await pointInsideDashboard(page);
        // Down, then back up from where the downward burst ended, so both stay clear of the page edges.
        for (const direction of [1, -1] as const) {
          const point = await pointOverVisibleDashboard(page, direction);
          await page.mouse.move(point.x, point.y);
          expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('IFRAME');
          const y0 = await page.evaluate(() => window.scrollY);
          const f0 = await frameScrollTotal(frame);
          for (const delta of deltas) await page.mouse.wheel(0, delta * direction);
          await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 }).toBeCloseTo(y0 + total * direction, -0.5);
          expect(await frameScrollTotal(frame)).toBe(f0);
          // The frame was under the pointer at the start and is still there, so every event landed on it.
          expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('IFRAME');
        }

        const point = await pointInsideDashboard(page);
        await page.mouse.move(point.x, point.y);
        const before = await page.evaluate(() => window.scrollY);
        const reversals = [40, 40, -30, 60, -50, 25, 25, -10, 35, 15];
        for (const delta of reversals) await page.mouse.wheel(0, delta);
        await expect
          .poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 })
          .toBeCloseTo(before + reversals.reduce((a, b) => a + b, 0), -0.5);

        const f1 = await frameScrollTotal(frame);
        const y1 = await page.evaluate(() => window.scrollY);
        await page.mouse.wheel(120, 0);
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => window.scrollY)).toBe(y1);
        expect(await frameScrollTotal(frame)).toBe(f1);

        expect(await frame.evaluate(() => getComputedStyle(document.querySelector('.admin-vtl-scroll')!).overflowY)).toBe('hidden');
        await context.close();
      });
    }
  }

  test('the dashboard stays interactive and its timeline still scrolls to "now"', async ({ browser }) => {
    const { context, frame } = await openHero(browser, '/', 1440);
    expect(await frame.evaluate(() => document.querySelector('.admin-vtl-scroll')!.scrollTop)).toBeGreaterThan(0);
    await frame.locator('.admin-sidebar-nav a:visible, .admin-sidebar-nav button:visible').filter({ hasText: 'Team' }).first().click();
    await expect(frame.locator('h1:visible, h2:visible').filter({ hasText: /^Team/ }).first()).toBeVisible();
    await context.close();
  });
});

type NavGeometry = { barTop: number; barLeft: number; barBottom: number; hubTop: number | null; topRowIsNav: boolean; scrollY: number };

const navGeometry = (page: Page): Promise<NavGeometry> =>
  page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-mnav]')!;
    const bar = root.querySelector('.mnav__bar')!.getBoundingClientRect();
    const hub = root.querySelector<HTMLElement>('.mnav-hub')!;
    const topRowIsNav = [2, innerWidth / 2, innerWidth - 2].every((x) => root.contains(document.elementFromPoint(x, 0.5)));
    return {
      barTop: bar.top,
      barLeft: bar.left,
      barBottom: bar.bottom,
      hubTop: hub.hidden ? null : hub.getBoundingClientRect().top,
      topRowIsNav,
      scrollY: window.scrollY,
    };
  });

const staleState = (page: Page) =>
  page.evaluate(() => ({
    locked: document.documentElement.classList.contains('mnav-locked'),
    open: document.querySelector('[data-mnav]')!.hasAttribute('data-mnav-hub-open'),
    inert: document.querySelectorAll('body > [inert]').length,
    flow: document.body.style.getPropertyValue('--mnav-flow-h'),
  }));

async function expectPinnedOpen(page: Page, scrollBefore: number | null) {
  // Immediately after the click, and again once the hub animation has finished.
  for (const wait of [0, 350]) {
    if (wait) await page.waitForTimeout(wait);
    const g = await navGeometry(page);
    expect(Math.abs(g.barTop)).toBeLessThanOrEqual(0.5);
    expect(g.barLeft).toBe(0);
    expect(g.topRowIsNav).toBe(true);
    if (scrollBefore !== null) expect(Math.abs(g.scrollY - scrollBefore)).toBeLessThanOrEqual(1);
    if (wait) expect(Math.abs((g.hubTop ?? NaN) - g.barBottom)).toBeLessThanOrEqual(1);
  }
}

async function openMobile(browser: Browser, path: string, width: number, height: number, mobile: boolean) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: true });
  const page = await context.newPage();
  await page.goto(path, { waitUntil: 'load' });
  await dismissConsent(page);
  return { context, page };
}

test.describe('mobile navigation: pinned to the top, page never moves', () => {
  for (const [width, height] of [
    [390, 844],
    [430, 932],
  ]) {
    for (const path of NAV_PAGES) {
      test(`${path} @${width}: open/close at any scroll position`, async ({ browser, browserName }) => {
        const { context, page } = await openMobile(browser, path, width, height, browserName !== 'firefox');
        const menu = page.locator('[data-mnav-menu]');
        const bottom = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

        for (const target of [0, 200, 1000, bottom - 2]) {
          await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target);
          await page.waitForTimeout(150);
          const before = await page.evaluate(() => window.scrollY);
          await menu.click();
          await expectPinnedOpen(page, before);
          await menu.click();
          expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(1);
          expect(await staleState(page)).toEqual({ locked: false, open: false, inert: 0, flow: '' });
        }

        await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
        const before = await page.evaluate(() => window.scrollY);
        for (let i = 0; i < 5; i++) await menu.click();
        await expectPinnedOpen(page, before);
        await page.locator('[data-mnav-accordion]').first().click();
        await page.locator('.mnav-hub__scroll').evaluate((el) => el.scrollBy(0, 400));
        await expectPinnedOpen(page, before);
        await page.keyboard.press('Escape');
        expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(1);
        expect(await staleState(page)).toEqual({ locked: false, open: false, inert: 0, flow: '' });
        await context.close();
      });
    }
  }

  test('stays pinned through a viewport change while open', async ({ browser, browserName }) => {
    const { context, page } = await openMobile(browser, '/', 390, 844, browserName !== 'firefox');
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
    const before = await page.evaluate(() => window.scrollY);
    await page.locator('[data-mnav-menu]').click();
    await expectPinnedOpen(page, before);
    // The page reflows at the new width, so only the pinning is asserted while rotated.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await expectPinnedOpen(page, null);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await expectPinnedOpen(page, null);
    await page.keyboard.press('Escape');
    expect(await staleState(page)).toEqual({ locked: false, open: false, inert: 0, flow: '' });
    await context.close();
  });

  test('survives Home → Fresha → Booksy → Calculator → Home soft navigation', async ({ browser, browserName }) => {
    const { context, page } = await openMobile(browser, '/', 390, 844, browserName !== 'firefox');
    await page.evaluate(() => ((window as unknown as { __softNavMarker: boolean }).__softNavMarker = true));
    for (const path of ['/fresha-alternative', '/booksy-alternative', '/barber-software-cost-calculator', '/']) {
      await page.evaluate((href) => {
        const a = Object.assign(document.createElement('a'), { href });
        document.body.append(a);
        a.click();
      }, path);
      await page.waitForURL((url) => url.pathname === path);
      await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-mnav]')?.dataset.mnavBound === 'true');
      expect(await page.evaluate(() => (window as unknown as { __softNavMarker?: boolean }).__softNavMarker)).toBe(true);
      expect(await page.locator('[data-mnav]').count()).toBe(1);
      expect(await staleState(page)).toEqual({ locked: false, open: false, inert: 0, flow: '' });

      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
      const before = await page.evaluate(() => window.scrollY);
      const menu = page.locator('[data-mnav-menu]');
      await menu.click();
      // A duplicated listener would toggle twice and leave the hub closed.
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expectPinnedOpen(page, before);
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(1);
    }
    await context.close();
  });

  test('choosing a hub link closes the hub and navigates without leaving the page locked', async ({ browser, browserName }) => {
    const { context, page } = await openMobile(browser, '/', 390, 844, browserName !== 'firefox');
    await page.locator('[data-mnav-menu]').click();
    const link = page.locator('.mnav-hub a[href="/fresha-alternative"]').first();
    for (const accordion of await page.locator('[data-mnav-accordion]').all()) {
      if (await link.isVisible()) break;
      await accordion.click();
    }
    await link.click();
    await page.waitForURL((url) => url.pathname === '/fresha-alternative');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-mnav]')?.dataset.mnavBound === 'true');
    expect(await staleState(page)).toEqual({ locked: false, open: false, inert: 0, flow: '' });
    await context.close();
  });
});
