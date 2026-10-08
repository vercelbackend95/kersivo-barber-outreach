/**
 * Real-browser checks for the Alternatives Hub (/compare):
 * - no horizontal overflow and the expected card column count at desktop, tablet and mobile widths;
 * - KERSIVO is always the first card;
 * - filter pills update the score rings, reset clears every priority and "Show all systems" reveals every card.
 *
 * Run against a production build: BASE_URL=http://127.0.0.1:4329 npx playwright test --config=scripts/alternatives-hub.playwright.config.mjs
 */
import { expect, test, type Page } from '@playwright/test';

const WIDTHS: { width: number; columns: number }[] = [
  { width: 1440, columns: 3 },
  { width: 820, columns: 2 },
  { width: 390, columns: 1 },
  { width: 320, columns: 1 },
];

async function openHub(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/compare', { waitUntil: 'load' });
  await page.waitForSelector('[data-hub-root][data-hub-ready="true"]');
}

function visibleCards(page: Page) {
  return page.locator('[data-hub-card]:visible');
}

function cardScore(page: Page, id: string) {
  return page.locator(`[data-hub-card][data-platform-id="${id}"] [data-hub-score-label]`);
}

for (const { width, columns } of WIDTHS) {
  test(`layout at ${width}px: no overflow, ${columns} column(s), KERSIVO first`, async ({ page }) => {
    await openHub(page, width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const gridColumns = await page
      .locator('[data-hub-grid]')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(gridColumns).toBe(columns);

    await expect(page.locator('[data-hub-card]').first()).toHaveAttribute('data-platform-id', 'kersivo');
    await expect(visibleCards(page)).toHaveCount(6);
    await expect(page.locator('h1')).toHaveCount(1);
  });
}

test('filters update the scores, reset clears every priority and KERSIVO stays first', async ({ page }) => {
  await openHub(page, 1440);
  await expect(cardScore(page, 'kersivo')).toHaveText('7/7');

  const retail = page.locator('[data-hub-filter="retail"]');
  await expect(retail).toHaveAttribute('aria-pressed', 'false');
  await retail.click();
  await expect(retail).toHaveAttribute('aria-pressed', 'true');
  await expect(cardScore(page, 'kersivo')).toHaveText('8/8');
  await expect(page.locator('[data-hub-selected-count]')).toHaveText('8');

  await page.locator('[data-hub-sort]').selectOption('name');
  await expect(page.locator('[data-hub-card]').first()).toHaveAttribute('data-platform-id', 'kersivo');
  await expect(page.locator('[data-hub-card]').nth(1)).toHaveAttribute('data-platform-id', 'booksy');

  await page.locator('[data-hub-reset]').click();
  await expect(page.locator('[data-hub-filter][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-hub-selected-count]')).toHaveText('0');
  await expect(cardScore(page, 'kersivo')).toHaveText('–');
  await expect(page.locator('[data-hub-card]').first()).toHaveAttribute('data-platform-id', 'kersivo');
});

test('show all systems reveals every card and can collapse again', async ({ page }) => {
  await openHub(page, 1440);
  const toggle = page.locator('[data-hub-show-all]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(visibleCards(page)).toHaveCount(11);
  await toggle.click();
  await expect(visibleCards(page)).toHaveCount(6);
});

test('mobile shows primary pills first and expands the remaining filters on demand', async ({ page }) => {
  await openHub(page, 390);
  const extraPill = page.locator('.alt-hub-pill--extra').first();
  await expect(extraPill).toBeHidden();
  const more = page.locator('[data-hub-more-filters]');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(extraPill).toBeVisible();
});

test('every comparison link resolves to a live page', async ({ page, request }) => {
  await openHub(page, 1440);
  const hrefs = await page
    .locator('[data-hub-card] a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href')!))]);
  expect(hrefs.length).toBeGreaterThanOrEqual(11);
  for (const href of hrefs) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});
