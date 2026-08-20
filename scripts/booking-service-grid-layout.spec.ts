import { expect, test, type Page } from '@playwright/test';

async function dismissConsent(page: Page) {
  const accept = page.getByRole('button', { name: 'Accept all' });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function serviceGridMetrics(page: Page, root = '.booking-choice-grid--services') {
  return page.evaluate((selector) => {
    const grid = document.querySelector(selector) as HTMLElement | null;
    if (!grid) return null;
    const cards = Array.from(grid.querySelectorAll('.booking-choice-card--service')) as HTMLElement[];
    const widths = cards.map((card) => Math.round(card.getBoundingClientRect().width));
    const lefts = cards.map((card) => Math.round(card.getBoundingClientRect().left));
    const style = getComputedStyle(grid);
    const tracks = style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
    return {
      template: style.gridTemplateColumns,
      columnCount: tracks.length,
      cardCount: cards.length,
      widths,
      lefts,
      lastCardWidth: widths[widths.length - 1] ?? 0,
      firstCardWidth: widths[0] ?? 0,
    };
  }, root);
}

test.describe('shared booking service grid layout', () => {
  test('mobile keeps a single service column', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/book', { waitUntil: 'networkidle' });
    await dismissConsent(page);
    await expect(page.locator('.booking-choice-grid--services').first()).toBeVisible();

    const metrics = await serviceGridMetrics(page);
    expect(metrics).toBeTruthy();
    expect(metrics!.columnCount).toBe(1);
    await assertNoHorizontalOverflow(page);
  });

  test('desktop uses two service columns with odd last tile unstretched', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/book', { waitUntil: 'networkidle' });
    await dismissConsent(page);
    await expect(page.locator('.booking-choice-grid--services').first()).toBeVisible();

    const metrics = await serviceGridMetrics(page);
    expect(metrics).toBeTruthy();
    expect(metrics!.columnCount).toBeGreaterThanOrEqual(2);
    expect(metrics!.cardCount).toBeGreaterThanOrEqual(2);

    if (metrics!.cardCount % 2 === 1) {
      const lastLeft = metrics!.lefts[metrics!.lefts.length - 1];
      const firstLeft = metrics!.lefts[0];
      expect(Math.abs(lastLeft - firstLeft)).toBeLessThanOrEqual(2);
      expect(metrics!.lastCardWidth).toBeLessThanOrEqual(metrics!.firstCardWidth + 2);
      expect(metrics!.lastCardWidth).toBeGreaterThan(metrics!.firstCardWidth * 0.85);
    }

    await assertNoHorizontalOverflow(page);
  });

  test('demo book shares the same desktop two-column service grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/demo/book', { waitUntil: 'networkidle' });
    await dismissConsent(page);
    await expect(page.locator('.booking-choice-grid--services').first()).toBeVisible();
    const metrics = await serviceGridMetrics(page);
    expect(metrics!.columnCount).toBeGreaterThanOrEqual(2);
    await assertNoHorizontalOverflow(page);
  });

  test('landing widget embeds BookingFlow with desktop two-column services and preview overlay', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await dismissConsent(page);

    const widget = page.locator('.lbw').first();
    await widget.scrollIntoViewIfNeeded();
    await expect(widget.locator('.booking-flow--preview')).toBeVisible();
    await expect(widget.locator('.booking-choice-grid--services').first()).toBeVisible();

    const metrics = await serviceGridMetrics(page, '.lbw .booking-choice-grid--services');
    expect(metrics!.columnCount).toBeGreaterThanOrEqual(2);

    // Wait for the Astro island to hydrate so service clicks advance the wizard.
    await expect
      .poll(
        async () => {
          const service = widget.locator('button.booking-choice-card--service').first();
          if (!(await service.count())) return 'missing';
          await service.click({ force: true });
          const title = await widget.locator('h2').first().textContent();
          return title?.trim() ?? '';
        },
        { timeout: 20000 },
      )
      .toMatch(/Choose a barber/i);

    await widget.getByRole('radio', { name: /Any barber/i }).click({ force: true });

    const slot = widget.locator('button.booking-slot').first();
    await expect(slot).toBeVisible({ timeout: 15000 });
    await slot.click({ force: true });

    await expect(widget.locator('.lbw-lock')).toBeVisible({ timeout: 8000 });
    await assertNoHorizontalOverflow(page);
  });
});
