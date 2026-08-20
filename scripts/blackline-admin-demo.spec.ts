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

async function dismissCookieBanner(page: Page) {
  const accept = page.getByRole('button', { name: 'Accept all' });
  try {
    await expect(accept).toBeVisible({ timeout: 4000 });
  } catch {
    return;
  }
  await accept.click();
  await expect(accept).toHaveCount(0);
}

async function openBlacklineAccountMenu(page: Page) {
  await dismissCookieBanner(page);
  const desktopProfile = page.locator('aside.admin-sidebar button.admin-sidebar-profile');
  if (await desktopProfile.isVisible()) {
    await desktopProfile.scrollIntoViewIfNeeded();
    await desktopProfile.click();
    await expect(page.getByRole('menu')).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: 'Open admin menu' }).click();
  await page.locator('#admin-mobile-drawer button.admin-sidebar-profile').click();
  await expect(page.getByRole('menu')).toBeVisible();
}

test.describe('BLACKLINE owner dashboard', () => {
  test('opens without login and hides onboarding chrome', async ({ page }) => {
    const errors = collectApplicationErrors(page);
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'BLACKLINE owner dashboard' })).toBeAttached();
    await expect(page.getByText('BLACKLINE owner demo', { exact: true })).toBeVisible();
    const conversionCta = page.locator('aside.admin-sidebar a.admin-sidebar-launch-cta');
    await expect(conversionCta).toBeVisible();
    await expect(conversionCta).toHaveAttribute('href', '/admin/launch');
    await expect(conversionCta).toHaveAttribute(
      'aria-label',
      'Launch my barbershop. Review your setup and go live',
    );
    await expect(conversionCta).toContainText('Launch my barbershop');
    await expect(conversionCta).toContainText('YOUR SHOP IS READY');
    await expect(conversionCta).toContainText('Review your setup & go live');
    await expect(conversionCta).not.toContainText(/choose your plan/i);
    await expect(conversionCta.locator('.admin-sidebar-launch-cta__icon svg')).toHaveCount(1);
    await expect(conversionCta.locator('.admin-sidebar-launch-cta__checklist')).toHaveCount(0);
    await expect(page.getByText('MAKE IT YOURS')).toHaveCount(0);
    await expect(page.getByText('CREATE MY SYSTEM')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'VIEW PLANS' })).toHaveCount(0);
    await expect(conversionCta.locator('form, input, progress, [type="checkbox"]')).toHaveCount(0);
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

  test('uses the BLACKLINE wordmark as tenant identity, not KERSIVO logos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });

    const desktopBrand = page.locator('aside.admin-sidebar .admin-sidebar-brand--blackline');
    await expect(desktopBrand.getByRole('img', { name: 'BLACKLINE BARBERS' })).toBeVisible();
    await expect(desktopBrand.getByText('Powered by KERSIVO')).toBeVisible();
    await expect(desktopBrand.locator('img[src*="logo_nobg"]')).toHaveCount(0);
    await expect(page.locator('aside.admin-sidebar .admin-sidebar-brand img')).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
    const mobileBrand = page.locator('.admin-mobile-header .admin-sidebar-brand--blackline');
    await expect(mobileBrand.getByRole('img', { name: 'BLACKLINE BARBERS' })).toBeVisible();
    await expect(mobileBrand.locator('img[src*="logo_nobg"]')).toHaveCount(0);

    await dismissCookieBanner(page);

    await page.getByRole('button', { name: 'Open admin menu' }).click();
    const drawer = page.locator('#admin-mobile-drawer');
    await expect(page.getByRole('button', { name: 'Open admin menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(drawer).toHaveClass(/admin-mobile-drawer--open/);
    const drawerBrand = drawer.locator('.admin-sidebar-brand--blackline');
    await expect(drawerBrand.getByRole('img', { name: 'BLACKLINE BARBERS' })).toBeVisible();
    await expect(drawerBrand.getByText('Powered by KERSIVO')).toBeVisible();
    const drawerCta = drawer.locator('a.admin-sidebar-launch-cta');
    await expect(drawerCta).toBeVisible();
    await expect(drawerCta).toHaveAttribute('href', '/admin/launch');
    await expect(drawerCta).toHaveAttribute(
      'aria-label',
      'Launch my barbershop. Review your setup and go live',
    );
    await expect(drawerCta).toContainText('Launch my barbershop');
    await expect(drawerCta).toContainText('Review your setup & go live');
    await expect(drawerCta).not.toContainText(/choose your plan/i);
    await expect(drawerCta.getByText('Sample data')).toHaveCount(0);
    await expect(drawerCta.getByText(/next task|% complete|checklist/i)).toHaveCount(0);
    await expect(drawerCta.locator('.admin-sidebar-launch-cta__checklist')).toHaveCount(0);
  });

  test('customer demo header and footer use the BLACKLINE wordmark', async ({ page }) => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/demo', { waitUntil: 'domcontentloaded' });
      const headerMark = page.locator('.bl-header .bl-wordmark').getByRole('img', { name: 'BLACKLINE BARBERS' });
      await expect(headerMark).toBeVisible();
      await expect(page.locator('.bl-header img[src*="logo_nobg"]')).toHaveCount(0);
      await expect(page.locator('footer.bl-footer').getByRole('img', { name: 'BLACKLINE BARBERS' })).toBeVisible();
      await expect(page.getByText('Demo experience by Kersivo')).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
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
    await expect(page.getByText('18 services · 3 featured')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Skin Fade: Featured' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Classic Cut & Finish: Featured' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Haircut & Beard: Featured' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Hot Towel Wet Shave: Not featured' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(page.locator('body')).not.toContainText('featured · —');
  });

  test('bookings_services alias opens the services section', async ({ page }) => {
    await page.goto('/demo/admin?section=bookings_services', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('18 services · 3 featured')).toBeVisible();
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

  test('sidebar launch CTA leaves the demo for /admin/launch', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/admin?section=bookings_dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('aside.admin-sidebar a.admin-sidebar-launch-cta').click();
    await expect(page).toHaveURL(/\/admin\/launch/);
    await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0);
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
    await expect(page.getByText('18 services · 3 featured')).toBeVisible();
    await page.getByRole('switch', { name: 'Skin Fade: Featured' }).click();
    await expect(page.getByRole('dialog', { name: /Sample data/i })).toBeVisible();
  });

  test('service settings open the sample-data lock instead of the editor', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      const method = request.method();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
      writes.push(`${method} ${request.url()}`);
    });

    await page.goto('/demo/admin?section=services', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('18 services · 3 featured')).toBeVisible();
    const urlBefore = page.url();
    const gear = page.locator('.admin-product-row__edit-btn').first();
    await expect(gear).toHaveAttribute('aria-label', 'Service settings — sample data is read-only');
    await gear.click();
    const dialog = page.getByRole('dialog', { name: /Sample data/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/This BLACKLINE owner dashboard is read-only/i)).toBeVisible();
    await expect(dialog.getByText('Ready to make it yours?')).toBeVisible();
    await expect(page.getByRole('link', { name: /create my barbershop/i })).toHaveAttribute(
      'href',
      '/admin/launch',
    );
    await expect(page.locator('.admin-demo-lock__card.auth-gate-card')).toHaveCount(1);
    await expect(page.locator('#admin-service-form-title')).toHaveCount(0);
    expect(page.url()).toBe(urlBefore);
    expect(writes.filter((entry) => /\/api\/(admin|demo\/admin)\//.test(entry))).toEqual([]);

    await page.getByRole('button', { name: 'Continue exploring' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(gear).toBeFocused();
    expect(page.url()).toBe(urlBefore);
    await gear.click();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Sample data/i })).toHaveCount(0);
    await expect(gear).toBeFocused();

    await gear.press('Enter');
    await expect(page.getByRole('dialog', { name: /Sample data/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(gear).toBeFocused();
    await gear.press('Space');
    await expect(page.getByRole('dialog', { name: /Sample data/i })).toBeVisible();
    await expect(page.locator('#admin-service-form-title')).toHaveCount(0);
  });

  test('product settings open the sample-data lock instead of the editor', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      const method = request.method();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
      writes.push(`${method} ${request.url()}`);
    });

    await page.goto('/demo/admin?section=shop_products', { waitUntil: 'domcontentloaded' });
    const gear = page.locator('.admin-product-row__edit-btn').first();
    await expect(gear).toBeVisible();
    await expect(gear).toHaveAttribute('aria-label', 'Product settings — sample data is read-only');
    const urlBefore = page.url();
    await gear.click();
    const dialog = page.getByRole('dialog', { name: /Sample data/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/This BLACKLINE owner dashboard is read-only/i)).toBeVisible();
    await expect(dialog.getByText('Ready to make it yours?')).toBeVisible();
    await expect(page.getByRole('link', { name: /create my barbershop/i })).toHaveAttribute(
      'href',
      '/admin/launch',
    );
    await expect(page.locator('.admin-demo-lock__card.auth-gate-card')).toHaveCount(1);
    await expect(page.locator('#admin-product-form-title')).toHaveCount(0);
    expect(page.url()).toBe(urlBefore);
    expect(writes.filter((entry) => /\/api\/(admin|demo\/admin)\//.test(entry))).toEqual([]);

    await page.getByRole('button', { name: 'Continue exploring' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(gear).toBeFocused();
    expect(page.url()).toBe(urlBefore);
    await gear.click();

    await page.keyboard.press('Escape');
    await expect(gear).toBeFocused();
    await gear.press('Enter');
    await expect(page.getByRole('dialog', { name: /Sample data/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await gear.press('Space');
    await expect(page.getByRole('dialog', { name: /Sample data/i })).toBeVisible();
    await expect(page.locator('#admin-product-form-title')).toHaveCount(0);
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
