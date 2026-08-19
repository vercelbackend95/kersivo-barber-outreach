import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('BLACKLINE service menu', () => {
  test('renders all 18 services without category filtering', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Choose your finish/i })).toBeVisible();
    await expect(page.locator('.bl-services-cat')).toHaveCount(0);
    await expect(page.locator('.bl-service-group')).toHaveCount(4);
    await expect(page.locator('.bl-service-group[hidden]')).toHaveCount(0);
    await expect(page.locator('.bl-service-item')).toHaveCount(18);
    await expect(page.getByRole('heading', { name: /Cuts & Fades/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Beard & Shave/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Hair & Beard Combos/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Grooming & Care/i })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Current service category' })).toBeVisible();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Cuts & Fades/i);
    await expect(page.locator('[data-bl-viewing-index]')).toHaveText(/01\s*\/\s*04/);
    await expect(page).not.toHaveURL(/category=/);
  });

  test('updates the viewing panel while scrolling without changing the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });

    await page.locator('#beard-and-shave').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Beard & Shave/i);
    await expect(page.locator('[data-bl-viewing-index]')).toHaveText(/02\s*\/\s*04/);

    await page.locator('#hair-and-beard-combos').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Hair & Beard Combos/i);
    await expect(page.locator('[data-bl-viewing-index]')).toHaveText(/03\s*\/\s*04/);

    await page.locator('#grooming-and-care').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Grooming & Care/i);
    await expect(page.locator('[data-bl-viewing-index]')).toHaveText(/04\s*\/\s*04/);

    await page.locator('.bl-services-close').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Grooming & Care/i);
    await expect(page).not.toHaveURL(/category=/);
  });

  test('keeps booking links on stable slugs', async ({ page }) => {
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: /Book Skin Fade, 45 minutes/i })).toHaveAttribute(
      'href',
      '/demo/book?service=skin-fade',
    );
    await expect(page.getByRole('link', { name: /Book Classic Cut and Finish, 35 minutes/i })).toHaveAttribute(
      'href',
      '/demo/book?service=haircut-finish',
    );
  });

  test('is keyboard operable without a category menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await page.locator('.bl-service-item[data-service-slug="hot-towel-shave"] .bl-service-book').focus();
    await expect(page.locator('.bl-service-item[data-service-slug="hot-towel-shave"] .bl-service-book')).toBeFocused();
    await expect(page.locator('.bl-service-group[data-category-slug="cuts-fades"]')).toBeVisible();
  });

  test('turns motion off when the user prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => page.locator('html').getAttribute('data-bl-services-motion')).toBeNull();
  });

  for (const viewport of VIEWPORTS) {
    test(`does not overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
      await assertNoHorizontalOverflow(page);
      await expect(page.locator('.bl-service-item')).toHaveCount(18);
      await page.locator('#hair-and-beard-combos').scrollIntoViewIfNeeded();
      await expect(page.locator('#hair-and-beard-combos')).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});
