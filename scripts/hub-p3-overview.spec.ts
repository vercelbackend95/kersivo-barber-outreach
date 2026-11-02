import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotDir =
  process.platform === 'win32'
    ? 'C:/tmp/kersivo-shots/hub-p3-overview-bento'
    : '/tmp/kersivo-shots/hub-p3-overview-bento';
mkdirSync(shotDir, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';
const WIDTHS = [375, 768, 1024, 1280, 1440] as const;
const HEIGHT: Record<number, number> = {
  375: 812,
  768: 1024,
  1024: 800,
  1280: 800,
  1440: 900,
};

type Seed = {
  ops: { email: string; password: string };
  requested: { id: string; token: string };
  ready: { id: string; token: string };
};

let seed: Seed;

async function signInOps(page: Page) {
  const res = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    data: { email: seed.ops.email, password: seed.ops.password },
  });
  expect(res.ok(), `ops sign-in ${res.status()}`).toBeTruthy();
}

async function setRequestedStatus(page: Page, status: 'REQUESTED' | 'IN_PROGRESS') {
  await signInOps(page);
  const res = await page.request.post(`/api/ops/preview-requests/${seed.requested.id}`, {
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    data: { action: 'set_status', status },
  });
  expect(res.ok(), `set_status ${status} ${res.status()}`).toBeTruthy();
}

async function emptyGridCells(page: Page) {
  return page.locator('.admin-hub-bento').evaluate((el) => {
    const names = getComputedStyle(el)
      .gridTemplateAreas.replace(/"/g, ' ')
      .split(/\s+/)
      .filter((name) => name && name !== '.');
    const unique = [...new Set(names)];
    const placed = new Set(
      [...el.children].map((child) => getComputedStyle(child).gridArea.split(' / ')[0]),
    );
    return unique.filter((name) => !placed.has(name));
  });
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} horizontal scroll`).toBeLessThanOrEqual(0);
}

async function expectEarlyBento(page: Page) {
  const overview = page.getByTestId('admin-hub-overview');
  await expect(overview.locator('[data-tile="progress"]')).toBeVisible();
  await expect(overview.locator('[data-tile="preview"] a.admin-hub-tile__hit')).toHaveAttribute(
    'href',
    '/admin/website',
  );
  await expect(overview.locator('[data-tile="preview"] .admin-hub-tile__open')).toBeVisible();
  await expect(overview.locator('[data-tile="content"] [data-testid="admin-hub-add-inline"]')).toBeVisible();
  await expect(overview.locator('[data-tile="colours"]')).toBeVisible();
  await expect(overview.locator('[data-tile="activity"] a.admin-hub-tile__open')).toHaveAttribute(
    'aria-label',
    'Open activity',
  );
  await expect(overview.locator('[data-tile="changes"]')).toHaveCount(0);
}

async function shots(page: Page, stage: string, expectChanges: boolean) {
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
  if (expectChanges) {
    await expect(page.locator('[data-tile="changes"]')).toHaveAttribute('href', '/admin/changes');
  } else {
    await expectEarlyBento(page);
  }
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
    await page.waitForTimeout(250);
    await expectNoHorizontalScroll(page, `${stage}@${width}`);
    expect(await emptyGridCells(page), `${stage}@${width} empty cells`).toEqual([]);
    await page.screenshot({ path: join(shotDir, `${stage}-${width}.png`), fullPage: true });
  }
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(240000);

test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/preview-hub-qa/seed');
  expect(res.ok()).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test('requested overview hides Changes and links the locked preview', async ({ page }) => {
  await page.goto(`/preview/${seed.requested.token}`);
  await expect(page).toHaveURL(/\/admin$/);
  await shots(page, 'requested', false);
});

test('designing overview keeps the red plus and activity arrow', async ({ page, context }) => {
  await setRequestedStatus(page, 'IN_PROGRESS');
  await context.clearCookies();
  try {
    await page.goto(`/preview/${seed.requested.token}`);
    await expect(page).toHaveURL(/\/admin$/);
    await shots(page, 'designing', false);

    await page.setViewportSize({ width: 1440, height: 900 });
    const plus = page.getByTestId('admin-hub-add-inline');
    await plus.focus();
    await expect(plus).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('admin-hub-add-menu').or(page.getByTestId('admin-hub-add-sheet'))).toBeVisible();
    await page.keyboard.press('Escape');

    const activity = page.locator('[data-tile="activity"] a.admin-hub-tile__open');
    await activity.focus();
    await expect(activity).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await page.keyboard.press('Escape');

    const preview = page.locator('[data-tile="preview"] a.admin-hub-tile__hit');
    await preview.focus();
    await expect(preview).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/website/);
  } finally {
    await page.context().clearCookies();
    await setRequestedStatus(page, 'REQUESTED');
  }
});

test('review overview shows the Changes tile', async ({ page }) => {
  await page.goto(`/preview/${seed.ready.token}`);
  await expect(page).toHaveURL(/\/admin$/);
  await shots(page, 'review', true);
});
