import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = join(root, 'docs/admin-hub/screens/qa');
mkdirSync(shotDir, { recursive: true });
const seed = JSON.parse(readFileSync(join(root, '.preview-hub-seed.json'), 'utf8'));
const WIDTHS = [360, 768, 1024, 1440] as const;

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function openReady(page: Page) {
  const response = await page.goto(`/preview/${seed.ready.token}`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.locator('.admin-hub-content')).toBeVisible();
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('preview hub QA: routes, widths, keyboard, console', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await openReady(page);
  await expect(page.locator('.admin-sidebar a[href="/admin"]')).toBeVisible();
  await expect(page.locator('.admin-sidebar a[href="/admin/changes"]')).toBeVisible();
  await expect(page.locator('.admin-sidebar a[href="/admin/website"]')).toBeVisible();
  await expect(page.locator('.admin-sidebar a[href="/admin/messages"]')).toBeVisible();
  await expect(page.locator('.admin-sidebar a[href="/admin/launch"]')).toHaveCount(0);
  await expect(page.locator('.admin-hub-tabs')).toHaveCount(0);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    await page.waitForTimeout(200);
    expect(await overflow(page), `overview@${width}`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: join(shotDir, `overview-${width}.png`), fullPage: true });
    const bento = page.locator('.admin-hub-bento');
    if (await bento.count()) {
      const cols = await bento.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      if (width < 768) expect(cols, `bento cols@${width}`).toBe(1);
      else if (width < 1280) expect(cols, `bento cols@${width}`).toBe(6);
      else expect(cols, `bento cols@${width}`).toBe(12);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const add = page.getByTestId('admin-hub-add');
  await expect(add).toBeVisible();
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('admin-hub-add-menu')).toBeVisible();
  await page.getByRole('menuitem', { name: /Shop photos/ }).click();
  await expect(page.getByTestId('admin-hub-app')).toBeVisible();
  await page.screenshot({ path: join(shotDir, 'add-dialog-1440.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('admin-hub-app')).toHaveCount(0);

  await page.locator('.admin-sidebar a[href="/admin/website"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('admin-hub-website')).toBeVisible();
  expect(await overflow(page), 'website@1440').toBeLessThanOrEqual(0);

  await page.goto('/admin');
  await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
  const copy = page.locator('.admin-hub-swatches button').first();
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(page.locator('.admin-hub-sr-only', { hasText: /copied/i })).toBeVisible({ timeout: 3000 });

  await page.goto('/admin/messages');
  await expect(page.getByTestId('admin-hub-messages')).toBeVisible();
  const composer = page.getByTestId('hub-message-body');
  await expect(composer).toBeVisible();
  await expect.poll(async () => {
    await composer.click();
    await composer.fill('QA keyboard message');
    return page.getByTestId('hub-send-message').isEnabled();
  }, { timeout: 15000 }).toBe(true);
  await page.getByTestId('hub-send-message').click();
  await expect(page.getByText('QA keyboard message').first()).toBeVisible({ timeout: 8000 });

  const axe = await new AxeBuilder({ page }).include('.admin-shell').analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);

  const serious = consoleErrors.filter(
    (line) =>
      !line.includes('Download the React DevTools') &&
      !line.includes('astro-dev-toolbar') &&
      !line.includes('Failed to load resource: the server responded with a status of 404') &&
      !line.includes('Outdated Optimize Dep'),
  );
  expect(serious, serious.join('\n')).toEqual([]);
});

