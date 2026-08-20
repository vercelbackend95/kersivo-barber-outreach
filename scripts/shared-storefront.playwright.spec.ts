import { expect, test } from '@playwright/test';

test.describe('shared storefront standard', () => {
  test('demo shop uses compact discovery, unified featured, and ATC icons', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop', { waitUntil: 'networkidle' });

    await expect(page.locator('.sf-shop[data-sf-theme="blackline"]')).toBeVisible();
    await expect(page.locator('[data-sf-discovery-variant="compact"]')).toBeVisible();
    await expect(page.locator('input[type="search"]')).toHaveCount(0);
    await expect(page.locator('.sf-spotlight--unified')).toBeVisible();
    await expect(page.locator('.sf-spotlight-progress')).toBeVisible();
    await expect(page.locator('.sf-grid .sf-atc--icon').first()).toBeVisible();

    const columns = await page.evaluate(() => {
      const grid = document.querySelector('.sf-grid');
      if (!grid) return 0;
      return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    });
    expect(columns).toBe(2);
  });

  test('demo PDP uses shared rail related products', async ({ page }) => {
    await page.goto('/demo/shop', { waitUntil: 'networkidle' });
    const firstCard = page.locator('.sf-grid a.sf-card-hit').first();
    await firstCard.click();
    await page.waitForURL(/\/demo\/shop\//);

    await expect(page.locator('.sf-pdp-page')).toBeVisible();
    await expect(page.locator('.sf-pdp-actions .sf-atc--icon')).toBeVisible();
    await expect(page.locator('[data-product-rail-variant="storefront"]')).toBeVisible();
  });

  test('marketing shop shares the same structural selectors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/shop', { waitUntil: 'networkidle' });

    await expect(page.locator('.sf-shop[data-sf-theme="kersivo"]')).toBeVisible();
    await expect(page.locator('[data-sf-discovery-variant="compact"]')).toBeVisible();
    await expect(page.locator('input[type="search"]')).toHaveCount(0);
    await expect(page.locator('.sf-spotlight--unified, .sf-empty')).toHaveCount(1);
  });
});
