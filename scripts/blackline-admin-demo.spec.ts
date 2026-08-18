import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 320, height: 568 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('BLACKLINE owner dashboard', () => {
  test('opens without login and hides onboarding', async ({ page }) => {
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'BLACKLINE owner dashboard' })).toBeAttached();
    await expect(page.getByText('BLACKLINE OWNER DEMO', { exact: true })).toBeVisible();
    await expect(page.getByLabel('BLACKLINE demo status').first()).toContainText('Sample data');
    await expect(page.getByText('READY TO LAUNCH')).toHaveCount(0);
    await expect(page.getByText('Continue setup')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open BLACKLINE customer website' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Kersivo' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toHaveCount(0);
  });

  test('banner round-trips between customer and owner views', async ({ page }) => {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Open BLACKLINE owner dashboard' }).click();
    await expect(page).toHaveURL(/\/demo\/admin/);
    await page.getByRole('link', { name: 'Open BLACKLINE customer website' }).click();
    await expect(page).toHaveURL(/\/demo\/?$/);
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}x${viewport.height} does not overflow horizontally`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('BLACKLINE OWNER DEMO', { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});
