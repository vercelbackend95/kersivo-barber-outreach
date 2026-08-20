import { expect, test } from '@playwright/test';

test.describe('demo checkout surface', () => {
  test('shows dark surface, Collect at shop name, and line thumbnails', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop', { waitUntil: 'networkidle' });

    const atc = page.locator('.sf-grid .sf-atc--icon').first();
    await expect(atc).toBeVisible();
    await atc.click();

    await page.goto('/demo/shop/checkout', { waitUntil: 'networkidle' });
    const surface = page.locator('[data-checkout-surface].checkout-surface');
    await expect(surface).toBeVisible();
    await expect(page.getByRole('heading', { name: /Collect at Blackline Barbers/i })).toBeVisible();

    const color = await page.locator('.bl-checkout-heading').evaluate((el) => getComputedStyle(el).color);
    // ivory-ish text on dark (rgb high channels)
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match!.map(Number);
    expect(r + g + b).toBeGreaterThan(500);

    await expect(page.locator('.checkout-line').first()).toBeVisible();
    await expect(page.locator('.checkout-line-media').first()).toBeVisible();
  });
});
