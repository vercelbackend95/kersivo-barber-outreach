import { expect, test, type Page } from '@playwright/test';
import { DEMO_PAGE_HERO_ROUTES } from '../src/lib/demo/pageHero';

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 320, height: 568 },
] as const;

async function waitForHero(page: Page) {
  await page.waitForSelector('.bl-page-hero-title');
  await page.evaluate(() => document.fonts.ready);
}

async function leftOf(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`missing ${selector}`);
  return box.x;
}

test.describe('BLACKLINE page heroes', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('align to one container and share H1 metrics', async ({ page }) => {
    const metrics: Array<Record<string, string>> = [];

    for (const route of DEMO_PAGE_HERO_ROUTES) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await waitForHero(page);

      const container = '.bl-page-hero .bl-container';
      const points = await page.evaluate((headingId) => {
        const eyebrow = document.querySelector('.bl-page-hero-eyebrow');
        const title = document.getElementById(headingId);
        const intro = document.querySelector('.bl-page-hero-intro');
        const wrap = document.querySelector('.bl-page-hero .bl-container');
        const nav = document.querySelector('.bl-header-inner');
        if (!eyebrow || !title || !intro || !wrap || !nav) {
          throw new Error('hero landmarks missing');
        }
        const titleBox = title.getBoundingClientRect();
        const header = document.querySelector('[data-bl-header]');
        const style = getComputedStyle(title);
        return {
          eyebrow: eyebrow.getBoundingClientRect().left,
          title: titleBox.left,
          intro: intro.getBoundingClientRect().left,
          container: wrap.getBoundingClientRect().left,
          nav: nav.getBoundingClientRect().left,
          titleRight: titleBox.right,
          titleTop: titleBox.top,
          headerBottom: header?.getBoundingClientRect().bottom ?? 0,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
        };
      }, route.headingId);

      expect(Math.abs(points.eyebrow - points.container)).toBeLessThanOrEqual(1);
      expect(Math.abs(points.title - points.container)).toBeLessThanOrEqual(1);
      expect(Math.abs(points.intro - points.container)).toBeLessThanOrEqual(1);
      expect(Math.abs(points.nav - points.container)).toBeLessThanOrEqual(1);
      expect(points.container).toBeGreaterThan(1);
      expect(points.scrollWidth).toBeLessThanOrEqual(points.clientWidth + 1);
      expect(points.title).toBeGreaterThanOrEqual(0);
      expect(points.titleRight).toBeLessThanOrEqual(1440);
      expect(points.titleTop).toBeGreaterThanOrEqual(points.headerBottom - 1);
      metrics.push({
        fontFamily: points.fontFamily,
        fontSize: points.fontSize,
        fontWeight: points.fontWeight,
        lineHeight: points.lineHeight,
        letterSpacing: points.letterSpacing,
      });
    }

    const first = metrics[0];
    for (const next of metrics.slice(1)) {
      expect(next).toEqual(first);
    }
  });

  test('keeps visible focus on header controls', async ({ page }) => {
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await waitForHero(page);
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return { width: '0px', color: 'transparent' };
      const style = getComputedStyle(el);
      return { width: style.outlineWidth, color: style.outlineColor };
    });
    expect(outline.width).not.toBe('0px');
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('reduced motion skips the entrance transform', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await waitForHero(page);
    const transform = await page.locator('.bl-page-hero-title').evaluate((el) => getComputedStyle(el).transform);
    expect(transform).toBe('none');
    await context.close();
  });

  for (const viewport of VIEWPORTS) {
    test(`services keeps a gutter at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
      await waitForHero(page);
      const box = await page.locator('.bl-page-hero .bl-container').boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThan(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow).toBe(false);
      const titleLeft = await leftOf(page, '.bl-page-hero-title');
      expect(Math.abs(titleLeft - box!.x)).toBeLessThanOrEqual(1);
    });
  }
});
