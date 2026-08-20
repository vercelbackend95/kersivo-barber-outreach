import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertSingleProductRow(page: Page) {
  const metrics = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('.bl-shop-rail .product-rail__item, .bl-shop-rail .shop6__item'),
    ) as HTMLElement[];
    if (items.length < 2) {
      return { ok: false, reason: 'not-enough-items', tops: [] as number[], count: items.length };
    }
    const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
    const first = tops[0];
    const ok = tops.every((top) => Math.abs(top - first) <= 2);
    return { ok, tops, count: items.length, reason: ok ? 'ok' : 'wrapped' };
  });
  expect(metrics.reason, JSON.stringify(metrics)).toBe('ok');
  expect(metrics.ok).toBe(true);
  expect(metrics.count).toBe(10);
}

test.describe('BLACKLINE home shop product rail', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`keeps one horizontal row at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/demo', { waitUntil: 'networkidle' });
      const rail = page.locator('.bl-shop-rail [data-product-rail-root]');
      await expect(rail).toBeVisible();
      await rail.scrollIntoViewIfNeeded();
      await assertSingleProductRow(page);
      await assertNoHorizontalOverflow(page);

      const peek = await page.evaluate(() => {
        const track = document.querySelector('.bl-shop-rail [data-product-rail-track]') as HTMLElement | null;
        if (!track) return { canScroll: false };
        return { canScroll: track.scrollWidth > track.clientWidth + 2 };
      });
      expect(peek.canScroll).toBe(true);
    });
  }

  test('shows ten products, no card shadows, real ATC, and shared cart updates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo', { waitUntil: 'networkidle' });

    const rail = page.locator('.bl-shop-rail [data-product-rail-root]');
    await rail.scrollIntoViewIfNeeded();

    await expect(page.locator('.bl-shop-rail .product-rail__item')).toHaveCount(10);
    await expect(rail.locator('[data-product-rail-status]')).toHaveText(/01\s*\/\s*10/);

    const ids = await page
      .locator('.bl-shop-rail [data-add-to-cart]')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-product-id')).filter(Boolean),
      );
    expect(new Set(ids).size).toBe(10);

    const shadow = await page.evaluate(() => {
      const card = document.querySelector('.bl-shop-rail .product-rail__card') as HTMLElement | null;
      if (!card) return null;
      const style = getComputedStyle(card);
      return { boxShadow: style.boxShadow, filter: style.filter };
    });
    expect(shadow?.boxShadow === 'none' || shadow?.boxShadow === '').toBe(true);
    expect(shadow?.filter === 'none' || shadow?.filter === '').toBe(true);

    await expect(page.locator('.bl-shop-rail .product-rail__affordance')).toHaveCount(0);
    await expect(page.locator('.bl-shop-rail img[src=""]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /view ironclad pomade/i })).toHaveAttribute(
      'href',
      /\/demo\/shop\/bl-product-ironclad-pomade/,
    );
    await expect(page.getByRole('link', { name: /view essential styling set/i })).toHaveAttribute(
      'href',
      /\/demo\/shop\/bl-product-essential-styling-set/,
    );

    const styling = page.getByRole('link', { name: /view essential styling set/i });
    await expect(styling.locator('.sf-media--fallback, .sf-media--wordmark')).toBeVisible();

    const bagCount = page.locator('[data-bl-bag-count]').first();
    const before = Number((await bagCount.textContent())?.trim() || '0');

    await page.getByRole('button', { name: /add to bag: ironclad pomade/i }).click();
    await expect.poll(async () => Number((await bagCount.textContent())?.trim() || '0')).toBe(
      before + 1,
    );

    await page.locator('[data-bl-bag-button]').first().click();
    await expect(page.locator('.sf-cart.is-open, [data-sf-cart].is-open')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/ironclad pomade/i).first()).toBeVisible();

    await page.getByRole('button', { name: /continue shopping/i }).click();
    await expect(page.locator('.sf-cart.is-open')).toHaveCount(0);

    const prev = rail.locator('[data-product-rail-prev]').first();
    const next = rail.locator('[data-product-rail-next]').first();
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(prev).toBeEnabled();

    await expect(page.locator('.bl-shop-cta')).toHaveAttribute('href', '/demo/shop');
  });

  test('keeps shop page card shadows intact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'networkidle' });
    const shadow = await page.evaluate(() => {
      const card = document.querySelector('.sf-shop--blackline .sf-card') as HTMLElement | null;
      if (!card) return null;
      return getComputedStyle(card).boxShadow;
    });
    expect(shadow && shadow !== 'none' && shadow !== '').toBe(true);
  });
});
