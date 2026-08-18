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

function collectApplicationErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function openBlacklineAccountMenu(page: Page) {
  const desktopProfile = page.locator('aside.admin-sidebar button.admin-sidebar-profile');
  if (await desktopProfile.isVisible()) {
    await desktopProfile.click();
    return;
  }
  await page.getByRole('button', { name: 'Open admin menu' }).click();
  await page.locator('#admin-mobile-drawer button.admin-sidebar-profile').click();
}

test.describe('BLACKLINE owner dashboard', () => {
  test('opens without login and hides onboarding chrome', async ({ page }) => {
    const errors = collectApplicationErrors(page);
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'BLACKLINE owner dashboard' })).toBeAttached();
    await expect(page.getByText('BLACKLINE owner demo', { exact: true })).toBeVisible();
    await expect(page.getByLabel('BLACKLINE demo status').first()).toContainText('Sample data');
    await expect(page.getByText('BLACKLINE OWNER DEMO', { exact: true })).toHaveCount(0);
    await expect(page.getByText('DEMO MODE')).toHaveCount(0);
    await expect(page.locator('.admin-demo-pill')).toHaveCount(0);
    await expect(page.getByText('READY TO LAUNCH')).toHaveCount(0);
    await expect(page.getByText('Continue setup')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open BLACKLINE customer website' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Kersivo' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('banner round-trips between customer and owner views', async ({ page }) => {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Open BLACKLINE owner dashboard' }).click();
    await expect(page).toHaveURL(/\/demo\/admin/);
    await page.getByRole('link', { name: 'Open BLACKLINE customer website' }).click();
    await expect(page).toHaveURL(/\/demo\/?$/);
  });

  test('shows three canonical featured services', async ({ page }) => {
    await page.goto('/demo/admin?section=services', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('4 services · 3 featured')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Skin Fade: Featured' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Haircut & Finish: Featured' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Haircut & Beard: Featured' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Hot Towel Shave: Not featured' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(page.locator('body')).not.toContainText('featured · —');
  });

  test('bookings_services alias opens the services section', async ({ page }) => {
    await page.goto('/demo/admin?section=bookings_services', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('4 services · 3 featured')).toBeVisible();
  });

  test('account menu has one create-shop CTA and no setup clutter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
    await openBlacklineAccountMenu(page);

    const createShop = page.getByRole('menuitem', { name: 'Create your own barbershop' });
    await expect(createShop).toBeVisible();
    await expect(createShop).toHaveAttribute('href', '/admin/onboarding');
    await expect(page.getByRole('menuitem', { name: 'Preview BLACKLINE website' })).toHaveAttribute(
      'href',
      '/demo',
    );
    await expect(page.getByRole('menuitem', { name: 'Back to Kersivo' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('menuitem', { name: 'Create account' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Launch My Barbershop' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Workspace setup' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Retail onboarding' })).toHaveCount(0);
  });

  test('create-shop CTA leaves the demo without opening the sample-data lock', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
    await openBlacklineAccountMenu(page);
    await page.getByRole('menuitem', { name: 'Create your own barbershop' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding/);
    await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  });

  test('blocked mutations still explain sample data', async ({ page }) => {
    await page.goto('/demo/admin?section=services', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('4 services · 3 featured')).toBeVisible();
    await page.getByRole('switch', { name: 'Skin Fade: Featured' }).click();
    await expect(page.getByRole('dialog', { name: /Sample data/i })).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}x${viewport.height} does not overflow horizontally`, async ({ page }) => {
      const errors = collectApplicationErrors(page);
      await page.setViewportSize(viewport);
      await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('BLACKLINE owner demo', { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }
});
