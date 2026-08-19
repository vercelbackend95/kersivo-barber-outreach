import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SCREEN_DIR = path.join(process.cwd(), 'tmp');

test.describe('BLACKLINE gallery journey', () => {
  test('renders six unique bento frames with bounded tiles', async ({ page }) => {
    mkdirSync(SCREEN_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/gallery', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /the blackline cut, in focus/i })).toBeVisible();
    const tiles = page.locator('.bl-work-tile');
    await expect(tiles).toHaveCount(6);

    const srcs = await page.locator('.bl-work-stage img').evaluateAll((images) =>
      images.map((image) => (image instanceof HTMLImageElement ? image.getAttribute('src') : null)),
    );
    expect(new Set(srcs).size).toBe(6);
    expect(srcs.every((src) => src?.startsWith('/demo/gallery/') && src.endsWith('.webp'))).toBe(true);

    const heights = await page.locator('.bl-work-stage').evaluateAll((stages) =>
      stages.map((stage) => stage.getBoundingClientRect().height),
    );
    const featureHeight = await page.locator('.bl-work-tile--feature .bl-work-stage').first().evaluate((el) =>
      el.getBoundingClientRect().height,
    );
    const remainderWidth = await page.locator('.bl-work-tile--remainder-one').evaluate((el) => {
      const tile = el.getBoundingClientRect();
      const grid = el.closest('.bl-work-grid')?.getBoundingClientRect();
      return { tileWidth: tile.width, gridWidth: grid?.width ?? 0 };
    });

    expect(Math.max(...heights)).toBeLessThanOrEqual(580);
    expect(featureHeight).toBeLessThanOrEqual(580);
    const featureBottom = await page.locator('.bl-work-tile--feature .bl-work-stage').first().evaluate((el) => el.getBoundingClientRect().bottom);
    expect(featureBottom).toBeLessThan(900);
    expect(remainderWidth.tileWidth).toBeLessThan(remainderWidth.gridWidth * 0.7);

    await page.screenshot({ path: path.join(SCREEN_DIR, 'gallery-after-1440.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileHeights = await page.locator('.bl-work-stage').evaluateAll((stages) =>
      stages.map((stage) => stage.getBoundingClientRect().height),
    );
    expect(Math.max(...mobileHeights)).toBeLessThanOrEqual(300);
    await page.screenshot({ path: path.join(SCREEN_DIR, 'gallery-after-390.png'), fullPage: true });
  });

  test('opens focus mode, wraps, restores focus, and locks scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/gallery', { waitUntil: 'domcontentloaded' });

    const firstTile = page.locator('[data-work-open="0"]');
    await firstTile.focus();
    await firstTile.click();

    const dialog = page.locator('dialog.bl-work-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    const overflow = await page.evaluate(() => ({
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    }));
    expect(overflow.html).toBe('hidden');
    expect(overflow.body).toBe('hidden');

    const firstSrc = await dialog.locator('[data-work-image]').getAttribute('src');
    await page.locator('[data-work-next]').click();
    await expect(dialog.locator('[data-work-image]')).not.toHaveAttribute('src', firstSrc ?? '');
    await page.locator('[data-work-prev]').click();
    await expect(dialog.locator('[data-work-image]')).toHaveAttribute('src', firstSrc ?? '');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(firstTile).toBeFocused();

    const unlocked = await page.evaluate(() => ({
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    }));
    expect(unlocked.html).not.toBe('hidden');
    expect(unlocked.body).not.toBe('hidden');
  });
});
