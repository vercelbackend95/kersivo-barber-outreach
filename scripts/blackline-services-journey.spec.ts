import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1440, height: 900 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('BLACKLINE service navigator', () => {
  test('filters by category, updates the URL, and restores with back/forward', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Choose your finish/i })).toBeVisible();
    await expect(page.locator('.bl-service-group[data-category-slug="cuts-fades"]')).toBeVisible();
    await expect(page.locator('.bl-service-group[data-category-slug="grooming-care"]')).toBeVisible();

    await page.locator('.bl-services-cat[data-category-slug="cuts-fades"]').click();
    await expect(page).toHaveURL(/category=cuts-fades/);
    await expect(page.locator('.bl-service-group[data-category-slug="cuts-fades"]')).toBeVisible();
    await expect(page.locator('.bl-service-group[data-category-slug="grooming-care"]')).toBeHidden();
    await expect(page.getByRole('link', { name: /Book Skin Fade/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Book Classic Cut and Finish/i })).toBeVisible();

    await page.locator('.bl-services-cat[data-category-slug="all"]').click();
    await expect(page).toHaveURL(/\/demo\/services\/?$/);
    await expect(page.locator('.bl-service-group[data-category-slug="grooming-care"]')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/category=cuts-fades/);
    await expect(page.locator('.bl-service-group[data-category-slug="grooming-care"]')).toBeHidden();

    await page.goForward();
    await expect(page).toHaveURL(/\/demo\/services\/?$/);
    await expect(page.locator('.bl-service-group[data-category-slug="grooming-care"]')).toBeVisible();
  });

  test('falls invalid category query values back to all', async ({ page }) => {
    await page.goto('/demo/services?category=not-a-category', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.bl-services-cat[data-category-slug="all"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.bl-service-group[data-category-slug="cuts-fades"]')).toBeVisible();
    await expect(page.locator('.bl-service-group[data-category-slug="grooming-care"]')).toBeVisible();
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

  test('is keyboard operable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await page.locator('.bl-services-cat[data-category-slug="beard-shave"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/category=beard-shave/);
    await expect(page.locator('.bl-service-group[data-category-slug="beard-shave"]')).toBeVisible();
    await expect(page.locator('.bl-service-group[data-category-slug="cuts-fades"]')).toBeHidden();
    await page.locator('.bl-service-item[data-service-slug="hot-towel-shave"] .bl-service-book').focus();
    await expect(page.locator('[data-bl-quick-mode="service"]')).toBeVisible();
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
      const cat = page.locator('.bl-services-cat[data-category-slug="hair-beard-combos"]');
      await cat.evaluate((node) => {
        node.scrollIntoView({ block: 'nearest', inline: 'center' });
        if (node instanceof HTMLButtonElement) node.click();
      });
      await expect(page.locator('.bl-service-group[data-category-slug="hair-beard-combos"]')).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});
