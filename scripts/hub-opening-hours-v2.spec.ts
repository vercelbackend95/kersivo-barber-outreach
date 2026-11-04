/**
 * hub-opening-hours-v2: Overview › Add to your website end to end on the real stack (seeded local Postgres).
 * Stages: requested without and with a draft shop, review, launch (read-only).
 * Run: npx playwright test --config=scripts/hub-opening-hours-v2.playwright.config.mjs
 */
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const shotDir =
  process.platform === 'win32'
    ? 'C:/tmp/kersivo-shots/hub-opening-hours-v2/e2e'
    : '/tmp/kersivo-shots/hub-opening-hours-v2/e2e';
mkdirSync(shotDir, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error('hub-opening-hours-v2 QA must use a local database');

type Seed = {
  owner: { email: string; password: string };
  requested: { id: string; token: string };
  ready: { id: string; token: string };
};
const seed = JSON.parse(readFileSync(join(process.cwd(), '.preview-hub-seed.json'), 'utf8')) as Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

/** Requested request back to "no draft shop, no website text". */
async function resetRequested() {
  await prisma.previewRequest.update({
    where: { id: seed.requested.id },
    data: { draftShopId: null, aboutText: null, instagramUrl: null, websiteExtraText: null },
  });
}

async function hideToolbar(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar{display:none!important}';
      document.head.append(style);
    });
  });
}

async function openSetup(page: Page, item?: string) {
  await page.goto(`/admin?app=materials${item ? `&item=${item}` : ''}`);
  await expect(page.getByTestId('website-setup')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('setup-progress')).toBeVisible({ timeout: 30000 });
}

/** The Add button is an island: retry until it has hydrated and the menu opens. */
async function openAddMenu(page: Page) {
  await expect(async () => {
    if (!(await page.getByRole('menu').isVisible())) await page.getByTestId('admin-hub-add').click();
    await expect(page.getByRole('menuitem', { name: /Business details/ })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30000 });
}

const hoursCard = (page: Page) => page.getByTestId('setup-hours');
const savebar = (page: Page) => page.getByTestId('setup-savebar');

test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe('requested stage', () => {
  test.beforeAll(resetRequested);

  test.beforeEach(async ({ page }) => {
    await hideToolbar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/preview/${seed.requested.token}`);
  });

  test('without a draft shop: first open has no save bar; Use these hours saves hours only', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
    });
    await openSetup(page);
    await expect(hoursCard(page).getByTestId('opening-hours-suggested')).toBeVisible();
    await expect(savebar(page)).toHaveCount(0);
    await expect(hoursCard(page).getByText('Not set up')).toBeVisible();
    await page.screenshot({ path: join(shotDir, 'requested-first-open-1440.png') });

    await hoursCard(page).getByRole('button', { name: 'Use these hours' }).click();
    await expect(hoursCard(page).getByText('Complete')).toBeVisible();
    await expect(page.getByTestId('admin-hub-toast')).toHaveText('Opening hours saved.');
    await expect(hoursCard(page).getByTestId('opening-hours-suggested')).toHaveCount(0);
    await expect(savebar(page)).toHaveCount(0);
    expect(writes.filter((w) => !w.includes('/analytics'))).toEqual([
      'POST /api/admin-hub/draft-shop',
      'PUT /api/admin-hub/opening-hours',
    ]);
  });

  test('with a draft shop: edit name, hours and Instagram; one save, one toast, reload shows them', async ({ page }) => {
    await openSetup(page);
    const shopName = `Hub QA Hours ${Date.now() % 100000}`;
    await page.getByLabel('Barbershop name').fill(shopName);
    await page.getByRole('button', { name: /^Change Monday hours/ }).click();
    await page.getByRole('group', { name: 'Opening hour on Monday' }).getByRole('button', { name: '08' }).click();
    await page.getByRole('group', { name: 'Opening minutes on Monday' }).getByRole('button', { name: ':15' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByLabel('Instagram').fill('@hubqahours');
    await expect(savebar(page)).toBeVisible();

    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/admin-hub/')) puts.push(`${r.method()} ${new URL(r.url()).pathname}`);
    });
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(savebar(page)).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('admin-hub-toast')).toHaveText('Changes saved.');
    expect(puts.sort()).toEqual(
      ['PATCH /api/admin-hub/details', 'PATCH /api/admin-hub/profile', 'PUT /api/admin-hub/opening-hours'].sort(),
    );

    await openSetup(page);
    await expect(page.getByLabel('Barbershop name')).toHaveValue(shopName);
    await expect(page.getByRole('button', { name: 'Change Monday hours, now 08:15 to 18:00' })).toBeVisible();
    await expect(page.getByLabel('Instagram')).toHaveValue(/hubqahours/);
    await expect(savebar(page)).toHaveCount(0);
  });

  test('a server 400 on hours keeps the edits and shows the error in Opening hours', async ({ page }) => {
    await openSetup(page);
    await page.route('**/api/admin-hub/opening-hours', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Opening hours could not be saved.' }) })
        : route.continue(),
    );
    await page.getByRole('switch', { name: 'Open on Sunday' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(hoursCard(page).getByRole('alert')).toHaveText('Opening hours could not be saved.');
    await expect(page.getByRole('switch', { name: 'Open on Sunday' })).toHaveAttribute('aria-checked', 'true');
    await expect(savebar(page)).toBeVisible();
    await page.screenshot({ path: join(shotDir, 'hours-400-1440.png') });

    // Discard clears everything.
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(savebar(page)).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Open on Sunday' })).toHaveAttribute('aria-checked', 'false');
    await expect(hoursCard(page).getByRole('alert')).toHaveCount(0);
  });

  for (const [item, id] of [
    ['business', 'setup-business'],
    ['hours', 'setup-hours'],
    ['text', 'text'],
    ['photos', 'photos'],
  ] as const) {
    test(`deep link item=${item} scrolls to and highlights its section`, async ({ page }) => {
      await openSetup(page, item);
      const section = page.locator(`#${id}`);
      await expect(section).toHaveClass(/is-hub-add-target/);
      await expect(section).toBeInViewport();
      const focusedInside = await section.evaluate((node) => node.contains(document.activeElement));
      expect(focusedInside).toBe(true);
      await expect(section).not.toHaveClass(/is-hub-add-target/, { timeout: 5000 });
    });
  }

  test('the Add menu offers Business details and Opening hours', async ({ page }) => {
    await page.goto('/admin');
    await openAddMenu(page);
    await expect(page.getByRole('menuitem', { name: /Business details/ })).toHaveAttribute('href', '/admin?app=materials&item=business');
    await page.getByRole('menuitem', { name: /Opening hours/ }).click();
    await expect(page.locator('#setup-hours')).toHaveClass(/is-hub-add-target/, { timeout: 30000 });
  });

  test('the leave dialog guards close, Esc, Back and switching app', async ({ page }) => {
    await page.goto('/admin');
    await openAddMenu(page);
    await page.getByRole('menuitem', { name: /Business details/ }).click();
    await expect(page.getByLabel('Barbershop name')).toBeVisible({ timeout: 30000 });
    await page.getByLabel('Phone').fill('0113 496 0999');

    // Close button → Keep editing returns focus to it.
    const close = page.getByRole('button', { name: 'Close' });
    await close.click();
    const dialog = page.getByTestId('admin-hub-leave-confirm');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Leave without saving?');
    await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await page.screenshot({ path: join(shotDir, 'leave-dialog-1440.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(close).toBeFocused();

    // Esc on the app.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();

    // Back.
    await page.goBack();
    await expect(dialog).toBeVisible();
    expect(new URL(page.url()).searchParams.get('app')).toBe('materials');
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Phone')).toHaveValue('0113 496 0999');

    // Switching app from an in-page link (the sidebar is under the window's scrim on desktop).
    await page.evaluate(() => (document.querySelector('a[href="/admin?app=colours"]') as HTMLAnchorElement).click());
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByTestId('admin-hub-app')).toHaveAttribute('data-app', 'colours', { timeout: 30000 });
  });

  test('375 px: no horizontal scroll with the picker open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openSetup(page, 'hours');
    await page.getByRole('button', { name: /^Change Tuesday hours/ }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBe(0);
    const picker = page.getByTestId('opening-hours-picker');
    const box = await picker.boundingBox();
    const cells = await picker.locator('.ks-hours__cell').evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ right: r.right, w: r.width, h: r.height })),
    );
    expect(cells.every((c) => c.w >= 44 && c.h >= 44)).toBe(true);
    expect(Math.max(...cells.map((c) => c.right))).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
  });
});

test.describe('review stage', () => {
  test('editable, saved hours show no banner and no save bar', async ({ page }) => {
    await hideToolbar(page);
    await page.goto(`/preview/${seed.ready.token}`);
    await openSetup(page);
    await expect(page.getByRole('switch', { name: 'Open on Monday' })).toBeVisible();
    await expect(savebar(page)).toHaveCount(0);
  });
});

test.describe('launch stage (read-only)', () => {
  test('hours render as text with no controls', async ({ page }) => {
    await hideToolbar(page);
    const res = await page.request.post('/api/auth/sign-in/email', {
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      data: { email: seed.owner.email, password: seed.owner.password },
    });
    expect(res.ok()).toBeTruthy();
    await page.goto('/admin?app=materials');
    await expect(page.getByTestId('website-setup')).toBeVisible({ timeout: 60000 });
    const editor = page.getByTestId('opening-hours-editor');
    await expect(editor).toBeVisible({ timeout: 30000 });
    await expect(editor.getByRole('switch')).toHaveCount(0);
    await expect(editor.getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('opening-hours-summary')).toBeVisible();
    await expect(savebar(page)).toHaveCount(0);
    await page.screenshot({ path: join(shotDir, 'launch-readonly-1440.png'), fullPage: true });
  });
});
