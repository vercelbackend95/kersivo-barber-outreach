/**
 * hub-setup-hours-inline: sidebar setup card on the real stack (seeded local Postgres).
 * - Opening hours row opens Add to your website on the hours section (no Opening hours window).
 * - Saving hours flips the row to done without a reload, and it stays done after a reload.
 * - Products is tagged Optional and is not counted.
 * Run: npx playwright test --config=scripts/hub-setup-hours-inline.playwright.config.mjs
 */
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const shotDir =
  process.platform === 'win32' ? 'C:/tmp/kersivo-shots/hub-setup-hours-inline' : '/tmp/kersivo-shots/hub-setup-hours-inline';
mkdirSync(shotDir, { recursive: true });

const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error('hub-setup-hours-inline QA must use a local database');

type Seed = { requested: { id: string; token: string } };
const seed = JSON.parse(readFileSync(join(process.cwd(), '.preview-hub-seed.json'), 'utf8')) as Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
const SHOT = process.env.SHOT_PREFIX || 'after';

async function hideToolbar(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar{display:none!important}';
      document.head.append(style);
    });
  });
}

const card = (page: Page) => page.locator('.admin-sidebar .admin-hub-setup');
const hoursRow = (page: Page) => card(page).locator('.admin-hub-setup__item', { hasText: 'Opening hours' });

async function expandCard(page: Page) {
  const toggle = card(page).locator('.admin-hub-setup__toggle');
  await expect(toggle).toBeVisible({ timeout: 60000 });
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass({ timeout: 30000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await prisma.previewRequest.update({
    where: { id: seed.requested.id },
    data: { draftShopId: null, aboutText: null, instagramUrl: null, websiteExtraText: null },
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('Opening hours goes to the inline section, saves and completes; Products is optional', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await hideToolbar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/preview/${seed.requested.token}`);
  await page.goto('/admin');
  await expandCard(page);

  // Before saving: hours to do, products optional, optional rows not counted.
  await expect(hoursRow(page)).toHaveClass(/is-todo|is-next/);
  await expect(hoursRow(page)).toHaveAttribute('href', '/admin?app=materials&item=hours');
  const products = card(page).locator('.admin-hub-setup__item', { hasText: 'Products' });
  await expect(products).toContainText('Optional');
  await expect(products).toHaveAttribute('aria-label', 'Products, Optional');
  await expect(card(page).locator('.admin-hub-setup__count')).toHaveText(/ of 5 done$/);
  const before = await card(page).locator('.admin-hub-setup__count').textContent();
  await page.screenshot({ path: join(shotDir, `${SHOT}-sidebar-1440.png`) });

  // Click the row: Add to your website on the hours section, never an Opening hours window.
  await hoursRow(page).click();
  const dialog = page.getByTestId('admin-hub-app');
  await expect(dialog).toBeVisible({ timeout: 60000 });
  await expect(dialog).toHaveAttribute('data-app', 'materials');
  await expect(page.locator('[data-app="hours"]')).toHaveCount(0);
  const hours = page.getByTestId('setup-hours');
  await expect(hours).toBeVisible({ timeout: 30000 });
  await expect(hours.locator('h2')).toBeFocused({ timeout: 10000 });
  await expect(hours).toBeInViewport();
  await page.screenshot({ path: join(shotDir, `${SHOT}-hours-section-1440.png`) });

  // Save: the sidebar row flips to done straight away and the count moves on.
  await hours.getByRole('button', { name: 'Use these hours' }).click();
  await expect(hours.getByText('Complete')).toBeVisible();
  await expect(hoursRow(page)).toHaveClass(/is-done/, { timeout: 15000 });
  await expect(hoursRow(page)).toHaveAttribute('aria-label', 'Opening hours, Done');
  const doneBefore = Number((before ?? '0').split(' ')[0]);
  await expect(card(page).locator('.admin-hub-setup__count')).toHaveText(`${doneBefore + 1} of 5 done`);
  await page.screenshot({ path: join(shotDir, `${SHOT}-saved-1440.png`) });

  // Reload: still done (derived from the saved rows).
  await page.goto('/admin');
  await expandCard(page);
  await expect(hoursRow(page)).toHaveClass(/is-done/);
  await page.screenshot({ path: join(shotDir, `${SHOT}-reloaded-1440.png`) });

  // 375 px: the hours section and the mobile menu card.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin?app=materials&item=hours');
  await expect(page.getByTestId('setup-hours')).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: join(shotDir, `${SHOT}-hours-section-375.png`) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.goto('/admin');
  await page.screenshot({ path: join(shotDir, `${SHOT}-overview-375.png`) });

  // "Outdated Optimize Dep" is the dev server re-bundling deps after an edit (dev only, never in a build).
  expect(
    errors.filter((text) => !/favicon|astro-dev-toolbar|\[vite\]|Outdated Optimize Dep/i.test(text)),
  ).toEqual([]);
});
