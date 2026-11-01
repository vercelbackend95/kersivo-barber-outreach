import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotDir = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/a4' : '/tmp/kersivo-shots/a4';
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

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} horizontal scroll`).toBeLessThanOrEqual(0);
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

async function shots(page: Page, stage: string) {
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
  await expect(page.locator('[data-tile="content"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-hub-add-tile"]')).toHaveCount(0);
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

test('requested overview bento', async ({ page }) => {
  await page.goto(`/preview/${seed.requested.token}`);
  await expect(page).toHaveURL(/\/admin$/);
  await shots(page, 'requested');
});

test('designing overview bento', async ({ page, context }) => {
  await setRequestedStatus(page, 'IN_PROGRESS');
  await context.clearCookies();
  try {
    await page.goto(`/preview/${seed.requested.token}`);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId('admin-hub-overview').locator('h1')).toContainText('designing');
    await shots(page, 'designing');
  } finally {
    await setRequestedStatus(page, 'REQUESTED');
  }
});

test('review overview bento', async ({ page }) => {
  await page.goto(`/preview/${seed.ready.token}`);
  await expect(page).toHaveURL(/\/admin$/);
  await shots(page, 'review');
});
