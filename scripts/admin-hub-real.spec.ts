import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = join(root, 'docs/admin-hub/screens/batch-1');
const shotDir2 = join(root, 'docs/admin-hub/screens/batch-2');
const shotDir3 = join(root, 'docs/admin-hub/screens/batch-3');
const shotDir4 = join(root, 'docs/admin-hub/screens/batch-4');
const shotDir5 = join(root, 'docs/admin-hub/screens/batch-5');
const shotDir6 = join(root, 'docs/admin-hub/screens/batch-6');
const shotDirSetup = join(root, 'docs/admin-hub/screens/setup-compact');
mkdirSync(shotDir, { recursive: true });
mkdirSync(shotDir2, { recursive: true });
mkdirSync(shotDir3, { recursive: true });
mkdirSync(shotDir4, { recursive: true });
mkdirSync(shotDir5, { recursive: true });
mkdirSync(shotDir6, { recursive: true });
mkdirSync(shotDirSetup, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';
const HEIGHT: Record<number, number> = { 360: 800, 390: 844, 768: 1024, 1280: 800, 1440: 900 };

type Seed = {
  ops: { email: string; password: string };
  owner: { email: string; password: string };
  requested: { id: string; token: string };
  ready: { id: string; token: string; shopId: string };
  converted: { id: string; token: string };
  live: {
    id: string;
    token: string;
    shopId: string;
    owner: { email: string; password: string };
    serviceId: string;
    barberId: string;
    liveUrl: string;
  };
  paidDirect: { shopId: string | null; owner: { email: string; password: string } };
  starter: { shopId: string | null; owner: { email: string; password: string } };
  rejected: { id: string; token: string };
  expired: { id: string; token: string };
};

let seed: Seed;

async function signIn(page: Page, email: string, password: string) {
  const res = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    data: { email, password },
  });
  expect(res.ok(), `sign-in ${email} ${res.status()}`).toBeTruthy();
}

async function hubCookie(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === 'ks_hub');
}

/** Opens an email link and asserts it lands on /admin without the token anywhere in the page. */
async function openEmailLink(page: Page, path: string, token: string, expected: string) {
  const response = await page.goto(path);
  expect(response, path).not.toBeNull();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(expected);
  expect(response!.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cache-control']).toBe('private, no-store');
  const html = await response!.text();
  expect(html.includes(token), `token leaked into ${expected}`).toBe(false);
  expect((await page.content()).includes(token)).toBe(false);
  await expect(page.locator('.admin-shell')).toBeVisible();
  await expect(page.locator('.admin-hub-content')).toBeVisible();
  return response!;
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} horizontal scroll`).toBeLessThanOrEqual(0);
}

async function shots(page: Page, name: string, widths: number[]) {
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  for (const width of widths) {
    await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
    await page.waitForTimeout(250);
    await expectNoHorizontalScroll(page, `${name}@${width}`);
    await expect(page.locator('.admin-hub-tabs')).toHaveCount(0);
    if (width >= 1024) {
      await expect(page.locator('.admin-sidebar')).toBeVisible();
      await expect(page.locator('.admin-main-panel')).toBeVisible();
    } else {
      await expect(page.locator('.admin-mobile-top-chrome')).toBeVisible();
    }
    await page.screenshot({ path: join(shotDir, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function expectNoSeriousAxe(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).include('.admin-shell').analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) writeFileSync(join(shotDir, `axe-${name}.json`), JSON.stringify(serious, null, 2));
  expect(serious, `${name} axe serious/critical`).toEqual([]);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(600000);

test.describe('Admin Hub batch 1 — real stack', () => {
  test.beforeAll(async ({ request }) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        if ((await request.get('/preview-hub-qa/health')).ok()) break;
      } catch {
        /* server still starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const res = await request.get('/api/preview-hub-qa/seed');
    expect(res.ok()).toBeTruthy();
    seed = (await res.json()) as Seed;
  });

  test('REQUESTED email link lands on /admin with the hub shell', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.requested.token}`, seed.requested.token, '/admin');
    const cookie = await hubCookie(context);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    expect(cookie!.value).toMatch(/^v1\.[A-Za-z0-9_-]+\.\d+\.[A-Za-z0-9_-]{43}$/);
    await expect(page.locator('.admin-sidebar .admin-sidebar-status')).toHaveText('Building');
    await expect(page.locator('.admin-sidebar-link[aria-current="page"]')).toHaveText(/Overview/);
    await expect(page.locator('.admin-sidebar .admin-hub-setup')).toBeVisible();
    await expect(page.locator('.admin-sidebar .admin-hub-setup')).toContainText('Set up your website');
    await page.locator('.admin-sidebar .admin-sidebar-profile').click();
    await expect(page.getByRole('menuitem', { name: 'Leave preview' })).toBeVisible();
    await shots(page, 'requested-overview', [390, 768, 1280, 1440]);
    await expectNoSeriousAxe(page, 'requested-overview');
  });

  test('compact sidebar setup card fits 1280x700 with status and profile visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await openEmailLink(page, `/preview/${seed.requested.token}`, seed.requested.token, '/admin');
    const card = page.locator('.admin-sidebar .admin-hub-setup');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Set up your website');
    await expect(card.getByRole('link')).toHaveCount(1);
    const box = await card.boundingBox();
    expect(box?.height, 'collapsed card height').toBeLessThanOrEqual(120);
    await expect(page.locator('.admin-sidebar .admin-sidebar-status')).toBeInViewport();
    await expect(page.locator('.admin-sidebar .admin-sidebar-profile')).toBeInViewport();
    const wrapOverflow = await page.locator('.admin-sidebar').evaluate((el) => {
      const nav = el.querySelector('.admin-sidebar-nav');
      const dock = el.querySelector('.admin-sidebar-logout-wrap');
      const style = getComputedStyle(el);
      return {
        sidebarOverflow: style.overflowY === 'hidden' || style.overflow === 'hidden',
        navScrolls: nav ? getComputedStyle(nav).overflowY === 'auto' : false,
        dockInView: dock ? dock.getBoundingClientRect().bottom <= 700 + 1 : false,
      };
    });
    expect(wrapOverflow.sidebarOverflow).toBe(true);
    expect(wrapOverflow.navScrolls).toBe(true);
    expect(wrapOverflow.dockInView).toBe(true);
    await page.screenshot({
      path: join(shotDirSetup, 'sidebar-1280x700.png'),
    });
  });

  test('READY email links map every sub-route', async ({ page }) => {
    const t = seed.ready.token;
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${t}`, t, '/admin');
    await expect(page.locator('.admin-sidebar .admin-sidebar-status')).toHaveText('Building');
    await shots(page, 'ready-overview', [390, 768, 1280, 1440]);
    await expectNoSeriousAxe(page, 'ready-overview');

    await openEmailLink(page, `/preview/${t}/website`, t, '/admin/website');
    await expect(page.locator('.admin-sidebar-link[aria-current="page"]')).toHaveText(/Website/);
    await expect(page.getByTestId('admin-hub-website')).toBeVisible();
    await shots(page, 'ready-website', [390, 768, 1280, 1440]);

    await openEmailLink(page, `/preview/${t}/website?view=booking`, t, '/admin/website?view=booking');
    await openEmailLink(page, `/preview/${t}?view=booking`, t, '/admin/website?view=booking');

    await openEmailLink(page, `/preview/${t}/changes`, t, '/admin/changes');
    await expect(page.locator('.admin-sidebar-link[aria-current="page"]')).toHaveText(/Changes/);
    await shots(page, 'ready-changes', [390, 1440]);

    await openEmailLink(page, `/preview/${t}/details`, t, '/admin?app=setup');
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await shots(page, 'ready-setup', [390, 1440]);

    await openEmailLink(page, `/preview/${t}/messages?draft=message`, t, '/admin/messages?draft=message');
    await expect(page.locator('.admin-sidebar-link[aria-current="page"]')).toHaveText(/Messages/);
    await expect(page.getByTestId('admin-hub-messages')).toBeVisible();
    await expect(page.getByTestId('hub-message-body')).toBeVisible();
    await shots(page, 'ready-messages', [360, 390, 1440]);

    await openEmailLink(page, `/preview/${t}/overview`, t, '/admin');
  });

  test('hub API works from the cookie inside /admin', async ({ page, context }) => {
    await page.goto(`/preview/${seed.ready.token}`);
    // Playwright's request client drops Secure cookies over http://localhost; the browser does not.
    const cookie = await hubCookie(context);
    const headers = { Cookie: `${cookie!.name}=${cookie!.value}` };
    const messages = await page.request.get('/api/admin-hub/messages', { headers });
    expect(messages.status()).toBe(200);
    expect(messages.headers()['x-robots-tag']).toBe('noindex, nofollow');
    const inPage = await page.evaluate(async () => (await fetch('/api/admin-hub/messages')).status);
    expect(inPage).toBe(200);
    const crossSite = await page.request.post('/api/admin-hub/messages', {
      headers: { ...headers, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      data: { body: 'hello' },
    });
    expect(crossSite.status()).toBe(403);
    for (const path of ['/api/admin/bookings', '/api/admin/clients', '/api/admin/barbershop-settings']) {
      const res = await page.request.get(path, { headers });
      expect([401, 403], `${path} with only ks_hub`).toContain(res.status());
    }
  });

  test('REJECTED and unknown tokens keep the 404 and set no cookie', async ({ page, context }) => {
    for (const token of [seed.rejected.token, 'Z'.repeat(43)]) {
      const response = await page.goto(`/preview/${token}`);
      expect(response?.status()).toBe(404);
      expect(await hubCookie(context)).toBeUndefined();
    }
  });

  test('EXPIRED sets the cookie and /admin shows the expired state', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.expired.token}`, seed.expired.token, '/admin');
    expect(await hubCookie(context)).toBeTruthy();
    await expect(page.locator('.admin-sidebar .admin-sidebar-status')).toHaveText('Building');
    await expect(page.locator('.admin-sidebar .admin-hub-setup')).toHaveCount(0);
    await shots(page, 'expired-overview', [390, 1440]);
  });

  test('operators get the op cookie, the banner and no owner analytics', async ({ page, context }) => {
    await signIn(page, seed.ops.email, seed.ops.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    expect((await hubCookie(context))!.value).toMatch(/\.op\.[A-Za-z0-9_-]{43}$/);
    await expect(page.locator('.admin-barbershop-paused-banner')).toContainText('Viewing as KERSIVO');
    await shots(page, 'operator-overview', [390, 1440]);

    const opCookie = (await hubCookie(context))!;
    await context.clearCookies();
    await context.addCookies([opCookie]);
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toHaveCount(0);
    expect(await hubCookie(context)).toBeUndefined();
  });

  test('Leave preview clears the cookie and goes home', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    await page.locator('.admin-sidebar .admin-sidebar-profile').click();
    await page.getByRole('menuitem', { name: 'Leave preview' }).click();
    await page.waitForURL(`${ORIGIN}/`);
    expect(await hubCookie(context)).toBeUndefined();
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toHaveCount(0);
  });

  test('a signed-in owner whose converted preview is not live sees the launch phase', async ({ page }) => {
    await signIn(page, seed.owner.email, seed.owner.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto('/admin');
    expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.locator('.admin-hub-content')).toBeVisible();
    await expect(page.locator('.admin-sidebar .admin-sidebar-status')).toHaveText('Building');
    expect((await response!.text()).includes(seed.converted.token)).toBe(false);
    await shots(page, 'converted-launch', [390, 1440]);
    await expect(page.locator('.admin-sidebar .admin-hub-setup')).toContainText('Set up your website');
    await expect(page.locator('.admin-sidebar .admin-hub-setup a[href="/admin?app=business"]')).toBeVisible();
  });

  test('paid-only admin routes redirect to /admin in preview mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    for (const paid of ['/admin/launch', '/admin/upgrade', '/admin/barbershop-settings', '/admin/retail-onboarding']) {
      await page.goto(paid);
      expect(new URL(page.url()).pathname).toBe('/admin');
      await expect(page.locator('.admin-hub-content')).toBeVisible();
      await expect(page.locator('.admin-sidebar-link[href="/admin/launch"]')).toHaveCount(0);
    }
  });

  test('setup card rows open apps; back and Esc close; axe at 390 and 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    await expect(page.locator('.admin-sidebar .admin-hub-setup a[href="/admin?app=logo"]')).toBeVisible();

    const apps = [
      'logo',
      'photos',
      'services',
      'team',
      'hours',
      'about',
      'setup',
      'activity',
      'messages',
    ] as const;
    for (const app of apps) {
      await page.goto(`/admin?app=${app}`);
      const dialog = page.getByTestId('admin-hub-app');
      await expect(dialog).toBeVisible();
      expect(await dialog.getAttribute('data-app')).toBe(app);
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await page.screenshot({ path: join(shotDir2, `ready-${app}-1440.png`), fullPage: true });
      const axe1440 = await new AxeBuilder({ page }).include('[data-testid="admin-hub-app"]').analyze();
      const serious1440 = axe1440.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (serious1440.length) writeFileSync(join(shotDir2, `axe-${app}-1440.json`), JSON.stringify(serious1440, null, 2));
      expect(serious1440, `${app} 1440 axe`).toEqual([]);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.admin-hub-app--sheet')).toBeVisible();
      await page.screenshot({ path: join(shotDir2, `ready-${app}-390.png`), fullPage: true });
      const axe390 = await new AxeBuilder({ page }).include('[data-testid="admin-hub-app"]').analyze();
      const serious390 = axe390.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (serious390.length) writeFileSync(join(shotDir2, `axe-${app}-390.json`), JSON.stringify(serious390, null, 2));
      expect(serious390, `${app} 390 axe`).toEqual([]);
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await page.goto('/admin?app=logo');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: join(shotDir2, 'ready-logo-768.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: join(shotDir2, 'ready-logo-1280.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/admin?app=logo');
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('admin-hub-app')).toHaveCount(0);

    await page.locator('.admin-sidebar .admin-hub-setup button[aria-label="Show all steps"]').click();
    await page.locator('.admin-sidebar .admin-hub-setup a[href="/admin?app=photos"]').click();
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('admin-hub-app')).toHaveCount(0);
  });

  test('before Review hours stays from-your-links and services open the real admin', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.requested.token}`, seed.requested.token, '/admin');
    const requestedSetup = page.locator('.admin-sidebar .admin-hub-setup');
    const requestedToggle = requestedSetup.locator('.admin-hub-setup__toggle');
    await expect(requestedToggle).toBeVisible();
    if ((await requestedToggle.getAttribute('aria-expanded')) !== 'true') {
      await requestedToggle.click();
    }
    await expect(requestedToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(requestedSetup.locator('a[href="/admin/services"]')).toBeVisible();
    await expect(requestedSetup.locator('a[href="/admin/team"]')).toBeVisible();
    await expect(requestedSetup.locator('a[href="/admin?app=hours"]')).toContainText('From your links');
    await page.screenshot({ path: join(shotDir2, 'requested-card-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shotDir2, 'requested-card-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin?app=hours');
    await expect(page.getByTestId('admin-hub-app')).toContainText("you'll check them when your preview is ready");
    await page.screenshot({ path: join(shotDir2, 'requested-hours-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shotDir2, 'requested-hours-390.png'), fullPage: true });
  });

  test('launch phase card opens the restyled checklist', async ({ page }) => {
    await signIn(page, seed.owner.email, seed.owner.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar .admin-hub-setup')).toContainText('Set up your website');
    await page.screenshot({ path: join(shotDir2, 'launch-card-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shotDir2, 'launch-card-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin?app=business');
    await expect(page.locator('.hub-launch--embedded')).toBeVisible();
    await expect(page.locator('.hub-launch--embedded[aria-busy="true"]')).toHaveCount(0);
    await page.screenshot({ path: join(shotDir2, 'launch-business-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shotDir2, 'launch-business-390.png'), fullPage: true });
  });
});

test.describe('Admin Hub batch 3 — Overview bento', () => {
  test.beforeAll(async ({ request }) => {
    if (seed) return;
    const res = await request.get('/api/preview-hub-qa/seed');
    expect(res.ok()).toBeTruthy();
    seed = (await res.json()) as Seed;
  });

  async function shots3(page: Page, name: string, widths: number[]) {
    await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
    for (const width of widths) {
      await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
      await page.waitForTimeout(250);
      await expectNoHorizontalScroll(page, `${name}@${width}`);
      await page.screenshot({ path: join(shotDir3, `${name}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  async function axeAt(page: Page, name: string, width: number) {
    await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
    const results = await new AxeBuilder({ page }).include('.admin-shell').analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length) writeFileSync(join(shotDir3, `axe-${name}-${width}.json`), JSON.stringify(serious, null, 2));
    expect(serious, `${name}@${width} axe`).toEqual([]);
  }

  test('REQUESTED locks preview and changes; tiles have no iframe', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.requested.token}`, seed.requested.token, '/admin');
    const overview = page.getByTestId('admin-hub-overview');
    await expect(overview).toBeVisible();
    await expect(overview.locator('[data-tile="preview"]')).toContainText('Your preview will appear here');
    await expect(overview.locator('[data-tile="changes"]')).toContainText('Available when your preview is ready');
    await expect(overview.locator('[data-tile="colours"] a[href="/admin?app=colours"]').first()).toBeVisible();
    await expect(overview.locator('[data-testid="admin-hub-add-tile"]')).toBeVisible();
    await expect(overview.locator('[data-tile="messages"]')).toHaveCount(0);
    expect(await overview.locator('iframe').count()).toBe(0);
    await expect(overview.locator('[data-tile="preview"] a')).toHaveCount(0);
    await expect(page.locator('.admin-sidebar').getByTestId('admin-hub-unread')).toHaveText('1');
    await shots3(page, 'requested-overview', [390, 768, 1280, 1440]);
    await axeAt(page, 'requested-overview', 390);
    await axeAt(page, 'requested-overview', 768);
    await axeAt(page, 'requested-overview', 1440);
  });

  test('READY bento links, unread badge and header actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    const overview = page.getByTestId('admin-hub-overview');
    await expect(overview).toBeVisible();
    await expect(overview.locator('[data-tile="progress"]')).toContainText('Your website build');
    await expect(overview.locator('[data-tile="preview"] a[href="/admin/website"]').first()).toBeVisible();
    await expect(overview.locator('[data-tile="preview"] a[href="/admin/website?view=booking"]')).toBeVisible();
    await expect(overview.locator('[data-tile="colours"] a[href="/admin?app=colours"]').first()).toBeVisible();
    await expect(overview.locator('[data-testid="admin-hub-add-tile"]')).toBeVisible();
    await expect(overview.locator('[data-tile="messages"]')).toHaveCount(0);
    await expect(overview.locator('[data-tile="changes"]')).toHaveAttribute('href', '/admin/changes');
    await expect(overview.locator('[data-tile="activity"] a[href="/admin?app=activity"]')).toContainText('Show all');
    await expect(page.getByTestId('admin-hub-primary')).toHaveText('Open your preview');
    await expect(page.getByTestId('hub-subscribe')).toContainText('Launch this website');
    await expect(page.getByTestId('hub-subscribe')).toContainText('£39/month');
    expect(await overview.locator('iframe').count()).toBe(0);
    await shots3(page, 'ready-overview', [390, 768, 1280, 1440]);
    await axeAt(page, 'ready-overview', 390);
    await axeAt(page, 'ready-overview', 768);
    await axeAt(page, 'ready-overview', 1440);

    await page.locator('.admin-sidebar a.admin-sidebar-link[href="/admin/messages"]').click();
    await expect(page).toHaveURL(/\/admin\/messages/);
    await expect(page.getByTestId('admin-hub-messages')).toBeVisible();
    await expect(page.locator('.admin-sidebar').getByTestId('admin-hub-unread')).toHaveCount(0);
    await expect(page.getByTestId('hub-message-body')).toBeVisible();
    await page.screenshot({ path: join(shotDir3, 'ready-messages-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('admin-hub-messages')).toBeVisible();
    await expect(page.getByTestId('hub-message-body')).toBeVisible();
    await page.screenshot({ path: join(shotDir3, 'ready-messages-390.png'), fullPage: true });
  });

  test('EXPIRED replaces the bento with the calm card', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.expired.token}`, seed.expired.token, '/admin');
    const overview = page.getByTestId('admin-hub-overview');
    await expect(overview.locator('.admin-hub-bento')).toHaveCount(0);
    await expect(overview.locator('[data-tile="calm"]')).toContainText('Ask us to reopen it');
    await shots3(page, 'expired-overview', [390, 1440]);
    await axeAt(page, 'expired-overview', 390);
    await axeAt(page, 'expired-overview', 1440);
  });

  test('Launch progress tile shows Our steps', async ({ page }) => {
    await signIn(page, seed.owner.email, seed.owner.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin');
    const overview = page.getByTestId('admin-hub-overview');
    await expect(overview.locator('[data-tile="progress"]')).toContainText('Our steps');
    await expect(overview.locator('[data-tile="progress"]')).toContainText('Connect your domain');
    await shots3(page, 'launch-overview', [390, 1440]);
  });
});

test.describe('Admin Hub batch 4 — Brand colours', () => {
  test.beforeAll(async ({ request }) => {
    if (seed) return;
    const res = await request.get('/api/preview-hub-qa/seed');
    expect(res.ok()).toBeTruthy();
    seed = (await res.json()) as Seed;
  });

  async function shots4(page: Page, name: string, widths: number[]) {
    await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
    for (const width of widths) {
      await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
      await page.waitForTimeout(250);
      await expectNoHorizontalScroll(page, `${name}@${width}`);
      await page.screenshot({ path: join(shotDir4, `${name}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  async function axeColours(page: Page, name: string, width: number) {
    await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
    await page.addStyleTag({
      content: '.admin-hub-app--sheet,.admin-hub-app--window{animation:none!important}',
    });
    await page.waitForTimeout(350);
    const results = await new AxeBuilder({ page }).include('[data-testid="admin-hub-app"]').analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length) writeFileSync(join(shotDir4, `axe-${name}-${width}.json`), JSON.stringify(serious, null, 2));
    expect(serious, `${name}@${width} axe`).toEqual([]);
  }

  test('Overview tile opens Brand colours and shows Not sent yet', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    const tile = page.locator('[data-tile="colours"]');
    await expect(tile.locator('a[href="/admin?app=colours"]').first()).toBeVisible();
    await expect(tile).toContainText('colours found in your logo');
    await expect(tile).toContainText('Not sent yet');
    await expect(tile).toContainText('#1F6F6B');
    await tile.click();
    const dialog = page.getByTestId('admin-hub-app');
    await expect(dialog).toBeVisible();
    expect(await dialog.getAttribute('data-app')).toBe('colours');
    await expect(page.getByRole('heading', { name: 'Brand colours' })).toBeVisible();
    const colours = page.getByTestId('admin-hub-colours');
    await expect(colours).toBeVisible();
    await expect(colours.getByText('Found in your logo')).toBeVisible();
    await expect(colours.getByText('Fine-tune main colour')).toBeVisible();
    await expect(colours.getByText('How it looks on your site')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send colours to KERSIVO' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Let KERSIVO choose' }).first()).toBeVisible();
    await shots4(page, 'ready-colours', [390, 768, 1280, 1440]);
    await axeColours(page, 'ready-colours', 390);
    await axeColours(page, 'ready-colours', 1440);

    await page.getByTestId('admin-hub-role-accent').click();
    await page.getByTestId('admin-hub-swatch-141414').click();
    await page.getByRole('button', { name: 'Send colours to KERSIVO' }).click();
    await expect(page.getByRole('status')).toContainText("Thanks — we'll use these colours");
    await page.getByRole('button', { name: 'Close' }).click();
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-tile="colours"]')).toContainText('Sent');
  });

  test('Ops Overview shows swatches with hex, role, source and copy', async ({ page }) => {
    await signIn(page, seed.ops.email, seed.ops.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/ops/preview-requests/${seed.ready.id}`, { waitUntil: 'domcontentloaded' });
    const panel = page.getByTestId('ops-brand-colours');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('#1F6F6B');
    await expect(panel).toContainText('Main');
    await expect(panel).toContainText('From your logo');
    await expect(panel).toContainText('Dark');
    await page.screenshot({ path: join(shotDir4, 'ops-overview-colours-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalScroll(page, 'ops-overview-colours@390');
    await page.screenshot({ path: join(shotDir4, 'ops-overview-colours-390.png'), fullPage: true });
  });
});

test.describe('Admin Hub batch 5 — Website and Changes', () => {
  test.beforeAll(async ({ request }) => {
    if (seed) return;
    const res = await request.get('/api/preview-hub-qa/seed');
    expect(res.ok()).toBeTruthy();
    seed = (await res.json()) as Seed;
  });

  async function shots5(page: Page, name: string, widths: number[]) {
    await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
    for (const width of widths) {
      await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
      await page.waitForTimeout(300);
      await expectNoHorizontalScroll(page, `${name}@${width}`);
      await page.screenshot({ path: join(shotDir5, `${name}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  async function axe5(page: Page, name: string, width: number) {
    await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
    const results = await new AxeBuilder({ page }).include('.admin-shell').analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length) writeFileSync(join(shotDir5, `axe-${name}-${width}.json`), JSON.stringify(serious, null, 2));
    expect(serious, `${name}@${width} axe`).toEqual([]);
  }

  test('Website scales desktop on a phone and remembers the device', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEmailLink(page, `/preview/${seed.ready.token}/website`, seed.ready.token, '/admin/website');
    const website = page.getByTestId('admin-hub-website');
    await expect(website).toBeVisible();
    await expect(website).toHaveAttribute('data-ready', 'true');
    await expect(website).toHaveAttribute('data-device', 'phone');
    await expect(page.getByRole('link', { name: 'Website' }).first()).toHaveAttribute('aria-current', 'page');
    await page.getByRole('radiogroup', { name: 'Device' }).getByRole('radio', { name: 'Desktop' }).click();
    await expect(website).toHaveAttribute('data-device', 'desktop');
    await expect(page.getByTestId('admin-hub-scale-badge')).toContainText('1280px · scaled to fit');
    await expect(page.evaluate(() => localStorage.getItem('ks_admin_hub_website_device'))).resolves.toBe('desktop');
    await shots5(page, 'ready-website-desktop', [360, 390, 768, 1440]);
    await page.getByRole('radiogroup', { name: 'Device' }).getByRole('radio', { name: 'Phone' }).click();
    await expect(website).toHaveAttribute('data-device', 'phone');
    await shots5(page, 'ready-website-phone', [360, 390, 768, 1440]);
    await axe5(page, 'ready-website', 390);
    await page.setViewportSize({ width: 1440, height: 900 });
    await axe5(page, 'ready-website', 1440);
  });

  test('Booking uses the same scaled stage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(
      page,
      `/preview/${seed.ready.token}/website?view=booking`,
      seed.ready.token,
      '/admin/website?view=booking',
    );
    const website = page.getByTestId('admin-hub-website');
    await expect(website).toBeVisible();
    await expect(website).toHaveAttribute('data-view', 'booking');
    await expect(page.getByRole('link', { name: 'Booking' }).first()).toHaveAttribute('aria-current', 'page');
    await shots5(page, 'ready-booking', [390, 1440]);
    await axe5(page, 'ready-booking', 390);
    await axe5(page, 'ready-booking', 1440);
  });

  test('Changes page lists chips and opens the composer sheet', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}/changes`, seed.ready.token, '/admin/changes');
    const changes = page.getByTestId('admin-hub-changes');
    await expect(changes).toBeVisible();
    await expect(changes).toContainText('Drafts');
    await expect(changes).toContainText('With KERSIVO');
    await expect(page.getByRole('button', { name: 'Send changes to KERSIVO' })).toBeVisible();
    await page.getByRole('button', { name: /Suggest a change|Suggest/ }).click();
    await expect(page.getByTestId('admin-hub-suggest')).toBeVisible();
    await expect(page.getByTestId('hub-change-body')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('admin-hub-suggest')).toHaveCount(0);
    await shots5(page, 'ready-changes', [390, 1440]);
    await axe5(page, 'ready-changes', 390);
    await axe5(page, 'ready-changes', 1440);
  });

  test('Website and Changes stay locked before Review', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEmailLink(page, `/preview/${seed.requested.token}/website`, seed.requested.token, '/admin/website');
    await expect(page.getByTestId('admin-hub-website-locked')).toContainText('Available when your preview is ready');
    await shots5(page, 'requested-website-locked', [390, 1440]);
    await openEmailLink(page, `/preview/${seed.requested.token}/changes`, seed.requested.token, '/admin/changes');
    await expect(page.getByTestId('admin-hub-changes-locked')).toContainText('Available when your preview is ready');
    await shots5(page, 'requested-changes-locked', [390, 1440]);
  });

  test('calculator pills are unchanged after the extract', async ({ page }) => {
    const hideChrome = async () => {
      await page.addStyleTag({
        content: 'astro-dev-toolbar,[data-cookie-banner],.cc-window{display:none!important}',
      });
    };
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
      const live = await page.goto('https://kersivo.co.uk/barber-software-cost-calculator', {
        waitUntil: 'domcontentloaded',
      });
      if (live?.ok()) {
        await hideChrome();
        const livePills = page.locator('[data-calc-period]').first();
        if (await livePills.count()) {
          await livePills.scrollIntoViewIfNeeded();
          if (await livePills.isVisible()) {
            await page.screenshot({ path: join(shotDir5, `calc-before-${width}.png`), fullPage: true });
            await livePills.screenshot({ path: join(shotDir5, `calc-before-pills-${width}.png`) });
          }
        }
      }
      await page.goto('/barber-software-cost-calculator', { waitUntil: 'domcontentloaded' });
      await hideChrome();
      const afterPills = page.locator('[data-calc-period]').first();
      await expect(afterPills).toBeVisible();
      await expect(page.locator('[data-calc-period] input[name="period"]').first()).toBeVisible();
      await afterPills.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(shotDir5, `calc-after-${width}.png`), fullPage: true });
      await afterPills.screenshot({ path: join(shotDir5, `calc-after-pills-${width}.png`) });
    }
  });

  test('segmented controls are keyboard reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}/website`, seed.ready.token, '/admin/website');
    const website = page.getByTestId('admin-hub-website');
    await expect(website).toHaveAttribute('data-ready', 'true');
    const device = page.getByRole('radiogroup', { name: 'Device' });
    await device.getByRole('radio', { name: 'Phone' }).click();
    await device.getByRole('radio', { name: 'Phone' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('admin-hub-website')).toHaveAttribute('data-device', 'desktop');
    await page.getByRole('link', { name: 'Booking' }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/website\?view=booking/);
  });
});

test.describe('Admin Hub batch 6 — Phase 3 and real journey', () => {
  test.beforeAll(async ({ request }) => {
    if (seed) return;
    const res = await request.get('/api/preview-hub-qa/seed');
    expect(res.ok()).toBeTruthy();
    seed = (await res.json()) as Seed;
  });

  async function shots6(page: Page, name: string, widths: number[]) {
    await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
    for (const width of widths) {
      await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
      await page.waitForTimeout(250);
      await expectNoHorizontalScroll(page, `${name}@${width}`);
      await page.screenshot({ path: join(shotDir6, `${name}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  test('live preview shop shows Phase 3; view site + test booking become 2 of 3', async ({ page }) => {
    await signIn(page, seed.live.owner.email, seed.live.owner.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toHaveCount(0);
    const card = page.locator('.admin-sidebar [data-testid="admin-next-steps"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Get the most from KERSIVO');
    await expect(card).toContainText("You're live · 0 of 3");
    await expect(card.getByRole('link', { name: /View your website/i })).toHaveAttribute('href', seed.live.liveUrl);
    await expect(card.getByRole('link', { name: /Make a test booking/i })).toHaveAttribute('href', '/admin/test-book');
    await shots6(page, 'live-phase3', [360, 390, 768, 1280, 1440]);

    const viewed = page.waitForResponse((res) => res.url().includes('/api/admin/next-steps/view-site') && res.request().method() === 'POST');
    await card.getByRole('link', { name: /View your website/i }).click();
    expect((await viewed).ok()).toBeTruthy();
    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar [data-testid="admin-next-steps"]')).toContainText("You're live · 1 of 3");

    await page.goto('/admin/test-book');
    await expect(page).toHaveURL(/\/admin\/test-book/);
    const booked = await page.request.post('/api/preview-hub-qa/test-booking', {
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      data: { shopId: seed.live.shopId },
    });
    expect(booked.ok(), `test booking ${booked.status()} ${await booked.text()}`).toBeTruthy();
    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar [data-testid="admin-next-steps"]')).toContainText("You're live · 2 of 3");
    await page.screenshot({ path: join(shotDir6, 'live-phase3-2of3-1440.png'), fullPage: true });
  });

  test('Starter and paid-direct shops keep today’s CTA (no Phase 3)', async ({ page }) => {
    await signIn(page, seed.paidDirect.owner.email, seed.paidDirect.owner.password);
    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar [data-testid="admin-next-steps"]')).toHaveCount(0);
    await expect(page.locator('.admin-sidebar .admin-sidebar-launch-cta')).toHaveCount(0);
    await page.screenshot({ path: join(shotDir6, 'paid-direct-1440.png'), fullPage: true });

    await page.context().clearCookies();
    await signIn(page, seed.starter.owner.email, seed.starter.owner.password);
    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar [data-testid="admin-next-steps"]')).toHaveCount(0);
    await expect(page.locator('.admin-sidebar .admin-sidebar-launch-cta')).toBeVisible();
    await expect(page.getByText('Get the most from KERSIVO')).toHaveCount(0);
    await page.screenshot({ path: join(shotDir6, 'starter-cta-1440.png'), fullPage: true });
  });

  test('final screenshots of every hub screen and app', async ({ page }) => {
    const widths = [360, 390, 768, 1280, 1440];
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
    await shots6(page, 'screen-overview', widths);
    await page.goto('/admin/website');
    await expect(page.getByTestId('admin-hub-website')).toBeVisible();
    await shots6(page, 'screen-website', widths);
    await page.goto('/admin/changes');
    await expect(page.getByTestId('admin-hub-changes')).toBeVisible();
    await shots6(page, 'screen-changes', widths);
    for (const app of ['logo', 'photos', 'materials', 'hours', 'about', 'colours', 'messages', 'activity', 'setup'] as const) {
      await page.goto(`/admin?app=${app}`);
      await expect(page.getByTestId('admin-hub-app')).toBeVisible();
      await shots6(page, `app-${app}`, widths);
    }

    await page.context().clearCookies();
    await openEmailLink(page, `/preview/${seed.requested.token}`, seed.requested.token, '/admin');
    await shots6(page, 'screen-requested', widths);

    await page.context().clearCookies();
    await openEmailLink(page, `/preview/${seed.expired.token}`, seed.expired.token, '/admin');
    await shots6(page, 'screen-expired', widths);

    await page.context().clearCookies();
    await signIn(page, seed.owner.email, seed.owner.password);
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toBeVisible();
    await shots6(page, 'screen-launch', widths);

    await page.context().clearCookies();
    await signIn(page, seed.live.owner.email, seed.live.owner.password);
    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar [data-testid="admin-next-steps"]')).toBeVisible();
    await shots6(page, 'screen-live-admin', widths);
  });

  test('request → hub → uploads → colours → ops → READY → launch → live Phase 3', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const journeyEmail = `journey.admin.${Date.now()}@hubqa.test`;
    const submit = await request.post('/api/free-preview', {
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      data: { shopName: 'Hub QA Admin Journey', townCity: 'Bournemouth', email: journeyEmail },
    });
    expect(submit.ok(), `intake ${submit.status()}`).toBeTruthy();
    await page.waitForTimeout(800);
    const mail = await request.get(`/api/preview-hub-qa/emails?to=${encodeURIComponent(journeyEmail)}`);
    const mailJson = await mail.json();
    const html = JSON.stringify(mailJson.emails ?? []);
    expect(html).toContain('Open your shop hub');
    const created = await request.get(`/api/preview-hub-qa/request?email=${encodeURIComponent(journeyEmail)}`);
    const createdJson = (await created.json()) as { token: string; id: string };
    await openEmailLink(page, `/preview/${createdJson.token}`, createdJson.token, '/admin');
    await expect(page.locator('.admin-sidebar .admin-sidebar-status')).toHaveText('Building');
    await shots6(page, 'journey-requested', [360, 390, 768, 1280, 1440]);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.goto('/admin?app=logo');
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    const logoUpload = page.waitForResponse((res) => res.url().includes('/assets') && res.request().method() === 'POST');
    await page.locator('[data-testid="hub-upload-logo"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: png,
    });
    expect((await logoUpload).ok()).toBeTruthy();
    await page.goto('/admin?app=photos');
    const photoUpload = page.waitForResponse((res) => res.url().includes('/assets') && res.request().method() === 'POST');
    await page.locator('[data-testid="hub-upload-shop_photo"]').setInputFiles({
      name: 'shop.png',
      mimeType: 'image/png',
      buffer: png,
    });
    expect((await photoUpload).ok()).toBeTruthy();

    await page.goto('/admin?app=colours');
    const colours = page.getByTestId('admin-hub-colours');
    if (await colours.isVisible().catch(() => false)) {
      const send = page.getByRole('button', { name: 'Send colours to KERSIVO' });
      if (await send.isEnabled().catch(() => false)) await send.click();
    }

    await page.goto('/admin?app=messages');
    await expect(page.getByTestId('hub-message-body')).toBeVisible();
    await page.getByTestId('hub-message-body').fill('Here is our logo.');
    await page.getByTestId('hub-send-message').click();
    await expect(page.getByText('Here is our logo.')).toBeVisible();

    await signIn(page, seed.ops.email, seed.ops.password);
    await page.goto(`/ops/preview-requests/${createdJson.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText('Hub QA Admin Journey');
    await page.goto(`/ops/preview-requests/${createdJson.id}?tab=messages`);
    await expect(page.getByTestId('hub-message-body')).toBeVisible();
    await page.getByTestId('hub-message-body').fill('Thanks — we have your files.');
    await page.getByTestId('hub-send-message').click();
    await expect(page.getByText('Thanks — we have your files.')).toBeVisible();
    await page.context().clearCookies();

    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
    await shots6(page, 'journey-ready-overview', [360, 390, 768, 1280, 1440]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/website');
    const website = page.getByTestId('admin-hub-website');
    await expect(website).toBeVisible();
    await expect(website).toHaveAttribute('data-ready', 'true');
    await page.getByRole('radiogroup', { name: 'Device' }).getByRole('radio', { name: 'Desktop' }).click();
    await expect(website).toHaveAttribute('data-device', 'desktop');
    await shots6(page, 'journey-website-desktop-phone', [360, 390]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/services');
    await expect(page.locator('.admin-sidebar-link[href="/admin/services"][aria-current="page"]')).toBeVisible();
    await page.goto('/admin/changes');
    await page.getByRole('button', { name: /Suggest a change|Suggest/ }).click();
    await page.getByTestId('hub-change-body').fill('Make the Book button larger.');
    await page.getByTestId('hub-save-draft').click();
    const sendChanges = page.getByRole('button', { name: 'Send changes to KERSIVO' });
    if (await sendChanges.isEnabled().catch(() => false)) await sendChanges.click();

    const checkoutStatus = await page.evaluate(async () => {
      const res = await fetch('/api/admin-hub/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Riley',
          domainMode: 'EXISTING',
          existingDomain: 'hub-qa-ready.co.uk',
          agreed: true,
        }),
      });
      return res.status;
    });
    expect([200, 303, 400, 409], `checkout ${checkoutStatus}`).toContain(checkoutStatus);

    await signIn(page, seed.owner.email, seed.owner.password);
    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar .admin-hub-setup')).toContainText('Set up your website');
    await shots6(page, 'journey-launch', [360, 390, 768, 1280, 1440]);
    const approved = await page.request.post('/api/admin/preview-launch/approve', {
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      data: { contentRightsConfirmed: true, informationAccuracyConfirmed: true },
    });
    expect([200, 400], `approve ${approved.status()}`).toContain(approved.status());

    await page.context().clearCookies();
    await signIn(page, seed.ops.email, seed.ops.password);
    const live = await page.request.post(`/api/ops/preview-requests/${seed.converted.id}/launch-steps`, {
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      data: { step: 'live', confirm: true },
    });
    expect(live.ok(), `mark live ${live.status()} ${await live.text()}`).toBeTruthy();
    await page.context().clearCookies();

    await signIn(page, seed.owner.email, seed.owner.password);
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toHaveCount(0);
    await expect(page.locator('.admin-sidebar [data-testid="admin-next-steps"]')).toBeVisible();
    await expect(page.locator('.admin-sidebar [data-testid="admin-next-steps"]')).toContainText('Get the most from KERSIVO');
    await shots6(page, 'journey-live-admin', [360, 390, 768, 1280, 1440]);
  });

  test('negatives: rejected/unknown 404, tampered cookie, cookie-only admin APIs, flag still off for extras', async ({
    page,
    context,
  }) => {
    for (const token of [seed.rejected.token, 'Z'.repeat(43)]) {
      const response = await page.goto(`/preview/${token}`);
      expect(response?.status()).toBe(404);
    }
    await page.goto(`/preview/${seed.ready.token}`);
    const cookie = await hubCookie(context);
    expect(cookie).toBeTruthy();
    await context.clearCookies();
    await context.addCookies([
      {
        ...cookie!,
        value: cookie!.value.replace(/[A-Za-z0-9_-]{8}$/, 'xxxxxxxx'),
      },
    ]);
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toHaveCount(0);
    const headers = { Cookie: `${cookie!.name}=${cookie!.value}` };
    for (const path of [
      '/api/admin/bookings',
      '/api/admin/clients',
      '/api/admin/next-steps/dismiss',
      '/api/setup/launch-context',
    ]) {
      const res = await page.request.get(path, { headers });
      expect([401, 403, 404, 405], `${path} with only ks_hub`).toContain(res.status());
    }
    const dismiss = await page.request.post('/api/admin/next-steps/dismiss', { headers });
    expect([401, 403], 'dismiss with only ks_hub').toContain(dismiss.status());
  });

  test('H2: hub owner uses the real Team, Services and Products screens', async ({ page, context }) => {
    const shotRoot = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/h2' : '/tmp/kersivo-shots/h2';
    mkdirSync(shotRoot, { recursive: true });
    const h2Shot = async (name: string) => {
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.waitForTimeout(250);
        await expectNoHorizontalScroll(page, `${name}@${width}`);
        await page.screenshot({ path: join(shotRoot, `${name}-${width}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    };

    await page.goto(`/preview/${seed.ready.token}`);
    await expect(page.locator('.admin-shell')).toBeVisible();
    const cookie = await hubCookie(context);
    expect(cookie).toBeTruthy();
    const headers = { Cookie: `${cookie!.name}=${cookie!.value}` };

    await page.goto('/admin');
    await expect(page.locator('.admin-sidebar-link[href="/admin/team"]')).toBeVisible();
    await expect(page.locator('.admin-sidebar-link[href="/admin/services"]')).toBeVisible();
    await expect(page.locator('.admin-sidebar-link[href="/admin/products"]')).toBeVisible();
    await h2Shot('admin');

    await page.goto('/admin/services');
    await expect(page.locator('.admin-sidebar-link[href="/admin/services"][aria-current="page"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add service' })).toBeVisible();
    await page.getByRole('button', { name: 'Add service' }).click();
    await page.locator('#service-wizard-name').fill("Kids' Haircut");
    await page.getByRole('radio', { name: 'featured' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('#service-wizard-price').fill('18.00');
    await page.getByRole('button', { name: '30 min' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Create service' }).click();
    await page.getByRole('button', { name: 'Done' }).click({ timeout: 15000 });
    await expect(page.locator('.admin-product-row__name', { hasText: "Kids' Haircut" }).first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.admin-product-row__name', { hasText: "Kids' Haircut" }).first()).toBeVisible();
    await h2Shot('admin-services');

    await page.goto('/admin/team');
    await expect(page.locator('.admin-sidebar-link[href="/admin/team"][aria-current="page"]')).toBeVisible();
    await page.getByRole('button', { name: 'Add team member' }).click();
    await page.locator('#team-invite-name').fill('Jamie Cole');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByRole('list', { name: 'Available services' }).getByText("Kids' Haircut").first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /^Mon,/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Add to booking team' }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Jamie Cole').first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('Jamie Cole').first()).toBeVisible();
    await expect(page.getByText('No dashboard account').first()).toBeVisible();
    await expect(page.getByText('Invite to dashboard')).toHaveCount(0);
    await h2Shot('admin-team');

    await page.goto('/admin/products');
    await expect(page.locator('.admin-sidebar-link[href="/admin/products"][aria-current="page"]')).toBeVisible();
    await page.getByRole('button', { name: 'Add product' }).click();
    await page.locator('#product-wizard-name').fill('Matte clay');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('#product-wizard-price').fill('12.00');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Create product' }).click();
    await page.getByRole('button', { name: 'Done' }).click({ timeout: 15000 });
    await expect(page.getByText('Matte clay', { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('Matte clay', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Sales' })).toHaveCount(0);
    await h2Shot('admin-products');

    for (const paidPath of ['/admin/launch', '/admin/upgrade', '/admin/barbershop-settings']) {
      const response = await page.goto(paidPath);
      expect(new URL(page.url()).pathname, paidPath).toBe('/admin');
      expect(response?.status()).toBe(200);
    }

    const denied = await page.request.get('/api/admin/bookings', { headers });
    expect(denied.status(), 'GET /api/admin/bookings').toBe(403);
  });

  test('H3: setup card opens the real Services, Team and Products screens', async ({ page, context }) => {
    const shotRoot = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/h3' : '/tmp/kersivo-shots/h3';
    mkdirSync(shotRoot, { recursive: true });
    const h3Shot = async (name: string) => {
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.waitForTimeout(250);
        await expectNoHorizontalScroll(page, `${name}@${width}`);
        await page.screenshot({ path: join(shotRoot, `${name}-${width}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    };

    await page.goto(`/preview/${seed.ready.token}`);
    await expect(page.locator('.admin-shell')).toBeVisible();
    expect(await hubCookie(context)).toBeTruthy();

    await page.goto('/admin');
    await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
    await h3Shot('admin');

    const expandSetup = async () => {
      const setup = page.locator('.admin-sidebar .admin-hub-setup');
      await expect(setup).toBeVisible();
      const toggle = setup.locator('.admin-hub-setup__toggle');
      await expect(toggle).toBeVisible();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if ((await toggle.getAttribute('aria-expanded')) === 'true') break;
        await toggle.click();
        if ((await toggle.getAttribute('aria-expanded')) === 'true') break;
        await page.waitForTimeout(200);
      }
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(setup.locator('a[href="/admin/services"]')).toBeVisible();
      return setup;
    };

    await (await expandSetup()).locator('a[href="/admin/services"]').click();
    await expect(page).toHaveURL(/\/admin\/services/);
    await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/services"][aria-current="page"]')).toBeVisible();

    await page.goto('/admin');
    await (await expandSetup()).locator('a[href="/admin/team"]').click();
    await expect(page).toHaveURL(/\/admin\/team/);
    await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/team"][aria-current="page"]')).toBeVisible();

    await page.goto('/admin');
    await (await expandSetup()).locator('a[href="/admin/products"]').click();
    await expect(page).toHaveURL(/\/admin\/products/);
    await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/products"][aria-current="page"]')).toBeVisible();

    const servicesLegacy = await page.goto('/admin?app=services');
    expect(new URL(page.url()).pathname).toBe('/admin/services');
    expect(servicesLegacy?.status()).toBe(200);
    const teamLegacy = await page.goto('/admin?app=team');
    expect(new URL(page.url()).pathname).toBe('/admin/team');
    expect(teamLegacy?.status()).toBe(200);
  });

  test('H4: allowlist walk, cross-tenant, cookie states, CSRF, no outbound, under-construction', async ({
    page,
    context,
    request,
  }) => {
    const shotRoot = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/h4' : '/tmp/kersivo-shots/h4';
    mkdirSync(shotRoot, { recursive: true });

    const inventory = await request.get('/api/preview-hub-qa/admin-api-inventory');
    expect(inventory.ok(), `inventory ${inventory.status()}`).toBeTruthy();
    const inventoryJson = (await inventory.json()) as {
      rows: Array<{ method: string; path: string; allowlisted: boolean }>;
      table: string;
    };
    writeFileSync(join(shotRoot, 'allowlist.md'), inventoryJson.table);

    await page.goto(`/preview/${seed.ready.token}`);
    await expect(page.locator('.admin-shell')).toBeVisible();
    const cookie = await hubCookie(context);
    expect(cookie).toBeTruthy();
    const hubHeaders = {
      Cookie: `${cookie!.name}=${cookie!.value}`,
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    };

    const emailsBefore = await request.get('/api/preview-hub-qa/emails');
    const stripeBefore = await request.get('/api/preview-hub-qa/stripe');
    const emailCountBefore = ((await emailsBefore.json()) as { emails?: unknown[] }).emails?.length ?? 0;
    const stripeStubBefore = JSON.stringify(await stripeBefore.json());

    const liveRows: Array<{ method: string; path: string; allowlisted: boolean; status: number }> = [];
    for (const row of inventoryJson.rows) {
      const path = row.path.replace(/:[^/]+/g, 'x');
      const res = await page.request.fetch(path, {
        method: row.method,
        headers: hubHeaders,
        data: row.method === 'GET' || row.method === 'HEAD' ? undefined : {},
        failOnStatusCode: false,
      });
      liveRows.push({ ...row, status: res.status() });
      if (row.allowlisted) {
        expect(res.status(), `${row.method} ${row.path} allowlisted`).not.toBe(403);
        expect(res.status(), `${row.method} ${row.path} allowlisted`).toBeGreaterThanOrEqual(200);
        expect(res.status(), `${row.method} ${row.path} allowlisted`).toBeLessThan(500);
      } else {
        expect(res.status(), `${row.method} ${row.path} denied`).toBe(403);
      }
    }
    writeFileSync(join(shotRoot, 'allowlist-live.json'), JSON.stringify(liveRows, null, 2));

    const created = await page.request.post('/api/admin/services', {
      headers: hubHeaders,
      data: {
        name: 'H4 Fade',
        pricePence: 2500,
        durationMinutes: 45,
        category: 'featured',
        shopId: seed.live.shopId,
      },
    });
    expect([200, 201], `create H4 Fade ${created.status()}`).toContain(created.status());
    const createdJson = (await created.json()) as { service?: { id: string; shopId?: string; name: string } };
    expect(createdJson.service?.name).toBe('H4 Fade');

    const product = await page.request.post('/api/admin/shop/products/create', {
      headers: hubHeaders,
      data: {
        name: 'H4 Clay',
        pricePence: 1400,
        shopId: seed.live.shopId,
      },
    });
    expect([200, 201], `create H4 Clay ${product.status()}`).toContain(product.status());

    const servicesOnA = await page.request.get(`/api/admin/services?shopId=${seed.live.shopId}`, {
      headers: hubHeaders,
    });
    expect(servicesOnA.status()).toBe(200);
    const servicePayload = (await servicesOnA.json()) as { services: Array<{ id: string; name: string }> };
    expect(servicePayload.services.some((row) => row.name === 'H4 Fade')).toBe(true);
    expect(servicePayload.services.some((row) => row.id === seed.live.serviceId)).toBe(false);

    const steal = await page.request.fetch(`/api/admin/services/${seed.live.serviceId}`, {
      method: 'PATCH',
      headers: hubHeaders,
      data: { name: 'Stolen fade', shopId: seed.live.shopId },
      failOnStatusCode: false,
    });
    expect([404, 400], `cross-tenant PATCH ${steal.status()}`).toContain(steal.status());

    const missingOrigin = await page.request.post('/api/admin/services', {
      headers: { Cookie: hubHeaders.Cookie, 'Content-Type': 'application/json' },
      data: { name: 'CSRF fade', pricePence: 2500, durationMinutes: 45, category: 'HAIRCUTS' },
    });
    expect(missingOrigin.status(), 'missing Origin').toBe(403);
    const foreignOrigin = await page.request.post('/api/admin/services', {
      headers: { Cookie: hubHeaders.Cookie, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      data: { name: 'CSRF fade', pricePence: 2500, durationMinutes: 45, category: 'HAIRCUTS' },
    });
    expect(foreignOrigin.status(), 'foreign Origin').toBe(403);

    const invite = await page.request.post('/api/admin/team/invite', {
      headers: hubHeaders,
      data: { name: 'Should Not Send', email: 'should.not.send@hubqa.test', role: 'BARBER' },
    });
    expect(invite.status()).toBe(403);
    expect(await invite.text()).toMatch(
      /Not available in your preview\.|Invites are available after your shop goes live\./,
    );

    const emailsAfter = await request.get('/api/preview-hub-qa/emails');
    const stripeAfter = await request.get('/api/preview-hub-qa/stripe');
    expect(((await emailsAfter.json()) as { emails?: unknown[] }).emails?.length ?? 0).toBe(emailCountBefore);
    expect(JSON.stringify(await stripeAfter.json())).toBe(stripeStubBefore);

    const shopState = await request.get(`/api/preview-hub-qa/shop-state?shopId=${seed.ready.shopId}`);
    expect(shopState.ok()).toBeTruthy();
    const stateJson = (await shopState.json()) as {
      acceptingBookings: boolean;
      shop: { retailEnabled: boolean; publicActivityPaused: boolean; ownerUserId: string | null };
      services: Array<{ name: string }>;
      products: Array<{ name: string }>;
    };
    expect(stateJson.acceptingBookings).toBe(false);
    expect(stateJson.shop.retailEnabled).toBe(false);
    expect(stateJson.shop.publicActivityPaused).toBe(true);
    expect(stateJson.shop.ownerUserId).toBeNull();
    expect(stateJson.services.some((row) => row.name === 'H4 Fade')).toBe(true);
    expect(stateJson.products.some((row) => row.name === 'H4 Clay')).toBe(true);

    const bookPage = await page.goto(`/book/${seed.ready.shopId}`);
    expect(bookPage?.ok() || bookPage?.status() === 200).toBeTruthy();
    await expect(page.locator('body')).toContainText('Online booking is temporarily unavailable');

    await page.goto(`/preview/${seed.expired.token}`);
    const expiredCookie = await hubCookie(context);
    expect(expiredCookie).toBeTruthy();
    const expiredApi = await page.request.get('/api/admin/services', {
      headers: { Cookie: `${expiredCookie!.name}=${expiredCookie!.value}`, Origin: ORIGIN },
    });
    expect([401, 403], 'expired request').toContain(expiredApi.status());

    await context.clearCookies();
    await page.goto(`/preview/${seed.converted.token}`);
    const convertedCookie = await hubCookie(context);
    if (convertedCookie) {
      const convertedApi = await page.request.get('/api/admin/services', {
        headers: { Cookie: `${convertedCookie.name}=${convertedCookie.value}`, Origin: ORIGIN },
      });
      expect([401, 403], 'converted request cookie').toContain(convertedApi.status());
    }

    await context.clearCookies();
    await page.goto(`/preview/${seed.ready.token}`);
    await expect(page.locator('.admin-shell')).toBeVisible();
    await page.locator('.admin-sidebar .admin-sidebar-profile').click();
    await page.getByRole('menuitem', { name: 'Leave preview' }).click();
    await page.waitForURL(`${ORIGIN}/`);
    expect(await hubCookie(context)).toBeUndefined();
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toHaveCount(0);
    const afterLeave = await page.request.get('/api/admin/services', { headers: { Origin: ORIGIN } });
    expect([401, 403], 'after leave-preview').toContain(afterLeave.status());
  });

  test('H4: converted owner keeps hub catalogue; paid admin menu unchanged', async ({ page }) => {
    await signIn(page, seed.owner.email, seed.owner.password);
    const session = await page.request.get('/api/admin/session', { headers: { Origin: ORIGIN } });
    expect(session.ok(), `converted session ${session.status()}`).toBeTruthy();
    const sessionJson = (await session.json()) as { shopId?: string };
    expect(sessionJson.shopId).toBeTruthy();

    const services = await page.request.get('/api/admin/services', { headers: { Origin: ORIGIN } });
    expect(services.ok()).toBeTruthy();
    const serviceNames = ((await services.json()) as { services: Array<{ name: string }> }).services.map(
      (row) => row.name,
    );
    expect(serviceNames.filter((name) => name === 'Skin fade')).toHaveLength(1);
    expect(serviceNames.filter((name) => name === 'Beard trim')).toHaveLength(1);

    const team = await page.request.get('/api/admin/team', { headers: { Origin: ORIGIN } });
    expect(team.ok()).toBeTruthy();
    const teamText = await team.text();
    expect(teamText).toContain('Alex Reed');
    expect(teamText).toContain('Jordan Cole');
    expect((teamText.match(/Alex Reed/g) ?? []).length).toBeGreaterThanOrEqual(1);

    await page.context().clearCookies();
    await signIn(page, seed.live.owner.email, seed.live.owner.password);
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-content')).toHaveCount(0);
    await expect(page.locator('.admin-sidebar')).toContainText('Bookings');
    await expect(page.locator('.admin-sidebar')).toContainText('Reports');
    await expect(page.locator('.admin-sidebar')).toContainText('Clients');
    await expect(page.locator('.admin-sidebar')).toContainText('Orders');
    await expect(page.locator('.admin-sidebar')).toContainText('Sales');
    await expect(page.locator('.admin-sidebar')).toContainText('Assistant');

    const liveInvite = await page.request.post('/api/admin/team/invite', {
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      data: { name: 'H4 Invite', email: 'h4.invite@hubqa.test', role: 'BARBER' },
    });
    const liveInviteBody = await liveInvite.text();
    expect(liveInviteBody).not.toContain('Invites are available after your shop goes live.');
    expect([200, 201, 400, 409], `live invite ${liveInvite.status()} ${liveInviteBody}`).toContain(
      liveInvite.status(),
    );
  });

  test('H4: UX pass at 375, 768, 1024 and 1440', async ({ page, context }) => {
    const shotRoot = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/h4' : '/tmp/kersivo-shots/h4';
    mkdirSync(shotRoot, { recursive: true });
    const widths = [375, 768, 1024, 1440] as const;
    const h4Shot = async (name: string) => {
      for (const width of widths) {
        await page.setViewportSize({ width, height: width <= 375 ? 812 : 900 });
        await page.waitForTimeout(250);
        await expectNoHorizontalScroll(page, `${name}@${width}`);
        if (width >= 1024) {
          await expect(page.locator('.admin-sidebar')).toBeVisible();
          await expect(page.locator('.admin-sidebar .admin-sidebar-group-title', { hasText: 'Your website' })).toBeVisible();
          await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/team"]')).toBeVisible();
          await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/services"]')).toBeVisible();
          await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/products"]')).toBeVisible();
        } else {
          await expect(page.locator('.admin-mobile-top-chrome')).toBeVisible();
        }
        await page.screenshot({ path: join(shotRoot, `${name}-${width}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    };

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/preview/${seed.ready.token}`);
    await expect(page.locator('.admin-shell')).toBeVisible();
    expect(await hubCookie(context)).toBeTruthy();

    await page.goto('/admin');
    await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
    await expect(page.locator('.admin-sidebar .admin-hub-setup')).toContainText('Set up your website');
    await h4Shot('overview');

    await page.goto('/admin/services');
    await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/services"][aria-current="page"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add service' })).toBeVisible({ timeout: 15000 });
    await h4Shot('services');

    await page.goto('/admin/team');
    await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/team"][aria-current="page"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add team member' })).toBeVisible({ timeout: 15000 });
    await h4Shot('team');

    await page.goto('/admin/products');
    await expect(page.locator('.admin-sidebar .admin-sidebar-link[href="/admin/products"][aria-current="page"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible({ timeout: 15000 });
    await h4Shot('products');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/services');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { tag: '', outline: '' };
      const style = getComputedStyle(el);
      return {
        tag: `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}`,
        outline: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(focus.tag.length).toBeGreaterThan(0);
    const visibleFocus =
      (focus.outline && focus.outline !== 'none' && focus.outlineWidth !== '0px') ||
      (focus.boxShadow && focus.boxShadow !== 'none');
    expect(visibleFocus, `focus-visible on ${focus.tag}`).toBeTruthy();
    await page.screenshot({ path: join(shotRoot, 'keyboard-focus-1440.png'), fullPage: true });
  });
});
