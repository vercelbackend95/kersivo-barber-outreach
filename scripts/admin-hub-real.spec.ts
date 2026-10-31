import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = join(root, 'docs/admin-hub/screens/batch-1');
const shotDir2 = join(root, 'docs/admin-hub/screens/batch-2');
const shotDir3 = join(root, 'docs/admin-hub/screens/batch-3');
mkdirSync(shotDir, { recursive: true });
mkdirSync(shotDir2, { recursive: true });
mkdirSync(shotDir3, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';
const HEIGHT: Record<number, number> = { 390: 844, 768: 1024, 1280: 800, 1440: 900 };

type Seed = {
  ops: { email: string; password: string };
  owner: { email: string; password: string };
  requested: { id: string; token: string };
  ready: { id: string; token: string; shopId: string };
  converted: { id: string; token: string };
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
  await expect(page.locator('.admin-hub')).toBeVisible();
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
    if (width >= 1024) {
      await expect(page.locator('.admin-hub-side')).toBeVisible();
      await expect(page.locator('.admin-hub-tabs')).toBeHidden();
    } else {
      await expect(page.locator('.admin-hub-top')).toBeVisible();
      await expect(page.locator('.admin-hub-tabs')).toBeVisible();
      await expect(page.locator('.admin-hub-side')).toBeHidden();
    }
    await page.screenshot({ path: join(shotDir, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function expectNoSeriousAxe(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).include('.admin-hub').analyze();
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
    await expect(page.locator('.admin-hub-side .admin-hub-pill')).toHaveText('Requested');
    await expect(page.locator('.admin-hub-navlink[aria-current="page"]')).toHaveText(/Overview/);
    await expect(page.locator('.admin-hub-side .admin-hub-setup')).toBeVisible();
    await expect(page.locator('.admin-hub-side .admin-hub-setup')).toContainText('Help us build your site');
    await expect(page.locator('.admin-hub-side')).toContainText('Private · hidden from search engines');
    await expect(page.locator('.admin-hub-side')).toContainText('Leave preview');
    await shots(page, 'requested-overview', [390, 768, 1280, 1440]);
    await expectNoSeriousAxe(page, 'requested-overview');
  });

  test('READY email links map every sub-route', async ({ page }) => {
    const t = seed.ready.token;
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${t}`, t, '/admin');
    await expect(page.locator('.admin-hub-side .admin-hub-pill')).toHaveText('Preview ready');
    await shots(page, 'ready-overview', [390, 768, 1280, 1440]);
    await expectNoSeriousAxe(page, 'ready-overview');

    await openEmailLink(page, `/preview/${t}/website`, t, '/admin?section=website');
    await expect(page.locator('.admin-hub-navlink[aria-current="page"]')).toHaveText(/Website/);
    await expect(page.locator('.hub-website')).toBeVisible();
    await shots(page, 'ready-website', [390, 768, 1280, 1440]);

    await openEmailLink(page, `/preview/${t}/website?view=booking`, t, '/admin?section=website&view=booking');
    await openEmailLink(page, `/preview/${t}?view=booking`, t, '/admin?section=website&view=booking');

    await openEmailLink(page, `/preview/${t}/changes`, t, '/admin?section=changes');
    await expect(page.locator('.admin-hub-navlink[aria-current="page"]')).toHaveText(/Changes/);
    await shots(page, 'ready-changes', [390, 1440]);

    await openEmailLink(page, `/preview/${t}/details`, t, '/admin?app=setup');
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await shots(page, 'ready-setup', [390, 1440]);

    await openEmailLink(page, `/preview/${t}/messages?draft=message`, t, '/admin?app=messages&draft=message');
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await expect(page.getByTestId('hub-message-body')).toBeVisible();
    await shots(page, 'ready-messages', [390, 1440]);

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
    for (const path of ['/api/admin/bookings', '/api/admin/clients', '/api/admin/team', '/api/admin/barbershop-settings']) {
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
    await expect(page.locator('.admin-hub-side .admin-hub-pill')).toHaveText('Expired');
    await expect(page.locator('.admin-hub-side .admin-hub-setup')).toHaveCount(0);
    await shots(page, 'expired-overview', [390, 1440]);
  });

  test('operators get the op cookie, the banner and no owner analytics', async ({ page, context }) => {
    await signIn(page, seed.ops.email, seed.ops.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    expect((await hubCookie(context))!.value).toMatch(/\.op\.[A-Za-z0-9_-]{43}$/);
    await expect(page.locator('.admin-hub-banner')).toContainText('Viewing as KERSIVO');
    await expect(page.locator('.admin-hub-account__who')).toHaveText('Viewing as KERSIVO');
    await shots(page, 'operator-overview', [390, 1440]);

    const opCookie = (await hubCookie(context))!;
    await context.clearCookies();
    await context.addCookies([opCookie]);
    await page.goto('/admin');
    await expect(page.locator('.admin-hub')).toHaveCount(0);
    expect(await hubCookie(context)).toBeUndefined();
  });

  test('Leave preview clears the cookie and goes home', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    await page.locator('.admin-hub-side').getByRole('button', { name: 'Leave preview' }).click();
    await page.waitForURL(`${ORIGIN}/`);
    expect(await hubCookie(context)).toBeUndefined();
    await page.goto('/admin');
    await expect(page.locator('.admin-hub')).toHaveCount(0);
  });

  test('a signed-in owner whose converted preview is not live sees the launch phase', async ({ page }) => {
    await signIn(page, seed.owner.email, seed.owner.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto('/admin');
    expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.locator('.admin-hub')).toBeVisible();
    await expect(page.locator('.admin-hub-side .admin-hub-pill')).toHaveText('Launch');
    expect((await response!.text()).includes(seed.converted.token)).toBe(false);
    await shots(page, 'converted-launch', [390, 1440]);
    await expect(page.locator('.admin-hub-side .admin-hub-setup')).toContainText("Let's put you live");
    await expect(page.locator('.admin-hub-side .admin-hub-setup a[href="/admin?app=business"]')).toBeVisible();
  });

  test('setup card rows open apps; back and Esc close; axe at 390 and 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.ready.token}`, seed.ready.token, '/admin');
    await expect(page.locator('.admin-hub-side .admin-hub-setup a[href="/admin?app=logo"]')).toBeVisible();

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

    await page.locator('.admin-hub-side .admin-hub-setup a[href="/admin?app=photos"]').click();
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('admin-hub-app')).toHaveCount(0);
  });

  test('before Review the services app shows the from-your-links state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEmailLink(page, `/preview/${seed.requested.token}`, seed.requested.token, '/admin');
    await expect(page.locator('.admin-hub-side .admin-hub-setup')).toContainText('From your links');
    await page.screenshot({ path: join(shotDir2, 'requested-card-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shotDir2, 'requested-card-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin?app=services');
    await expect(page.getByTestId('admin-hub-app')).toContainText("you'll check them when your preview is ready");
    await page.screenshot({ path: join(shotDir2, 'requested-services-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shotDir2, 'requested-services-390.png'), fullPage: true });
  });

  test('launch phase card opens the restyled checklist', async ({ page }) => {
    await signIn(page, seed.owner.email, seed.owner.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin');
    await expect(page.locator('.admin-hub-side .admin-hub-setup')).toContainText("Let's put you live");
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
    const results = await new AxeBuilder({ page }).include('.admin-hub').analyze();
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
    await expect(overview.locator('[data-tile="colours"]')).toHaveAttribute('href', '/admin?app=colours');
    await expect(overview.locator('[data-tile="messages"]')).toHaveAttribute('href', '/admin?app=messages');
    expect(await overview.locator('iframe').count()).toBe(0);
    await expect(overview.locator('[data-tile="preview"] a')).toHaveCount(0);
    await expect(page.getByTestId('admin-hub-unread')).toHaveText('1 unread');
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
    await expect(overview.locator('[data-tile="preview"] a[href="/admin?section=website"]').first()).toBeVisible();
    await expect(overview.locator('[data-tile="preview"] a[href="/admin?section=website&view=booking"]')).toBeVisible();
    await expect(overview.locator('[data-tile="colours"]')).toHaveAttribute('href', '/admin?app=colours');
    await expect(overview.locator('[data-tile="messages"]')).toHaveAttribute('href', '/admin?app=messages');
    await expect(overview.locator('[data-tile="changes"]')).toHaveAttribute('href', '/admin?section=changes');
    await expect(overview.locator('[data-tile="activity"] a[href="/admin?app=activity"]')).toContainText('Show all');
    await expect(page.getByTestId('admin-hub-primary')).toHaveText('Open your preview');
    await expect(page.getByTestId('hub-subscribe')).toContainText('Launch this website');
    await expect(page.getByTestId('hub-subscribe')).toContainText('£39/month');
    expect(await overview.locator('iframe').count()).toBe(0);
    await shots3(page, 'ready-overview', [390, 768, 1280, 1440]);
    await axeAt(page, 'ready-overview', 390);
    await axeAt(page, 'ready-overview', 768);
    await axeAt(page, 'ready-overview', 1440);

    await overview.locator('[data-tile="messages"]').click();
    const dialog = page.getByTestId('admin-hub-app');
    await expect(dialog).toBeVisible();
    expect(await dialog.getAttribute('data-app')).toBe('messages');
    await expect(page.getByTestId('hub-message-body')).toBeVisible();
    await page.screenshot({ path: join(shotDir3, 'ready-messages-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.admin-hub-app--sheet')).toBeVisible();
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
