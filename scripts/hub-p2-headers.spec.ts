import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotRoot =
  process.platform === 'win32'
    ? 'C:/tmp/kersivo-shots/hub-p2-section-headers'
    : '/tmp/kersivo-shots/hub-p2-section-headers';
mkdirSync(shotRoot, { recursive: true });

const WIDTHS = [375, 768, 1024, 1440] as const;
const HEIGHT: Record<(typeof WIDTHS)[number], number> = {
  375: 812,
  768: 1024,
  1024: 900,
  1440: 900,
};

type Seed = {
  ready: { token: string };
  live: { owner: { email: string; password: string } };
};

async function hideToolbar(page: Page) {
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
}

async function titleMetrics(page: Page) {
  const title = page.locator('.admin-section-header-title').first();
  await expect(title).toBeVisible();
  return title.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    return {
      left: Math.round(rect.left * 10) / 10,
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      color: styles.color,
    };
  });
}

async function shotHeader(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: HEIGHT[width as keyof typeof HEIGHT] });
  await page.waitForTimeout(250);
  const header = page.locator('.admin-section-header').first();
  await expect(header).toBeVisible();
  await page.screenshot({ path: join(shotRoot, `${name}-${width}.png`), fullPage: false });
  await header.screenshot({ path: join(shotRoot, `${name}-header-${width}.png`) });
}

test('hub section headers match Team at 375–1440', async ({ page, request }) => {
  const res = await request.get('/api/preview-hub-qa/seed');
  expect(res.ok()).toBeTruthy();
  const seed = (await res.json()) as Seed;

  const teamLeft: Record<number, number> = {};
  const teamFont: Record<number, Awaited<ReturnType<typeof titleMetrics>>> = {};

  await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: 'http://127.0.0.1:4397', 'Content-Type': 'application/json' },
    data: { email: seed.live.owner.email, password: seed.live.owner.password },
  });
  await page.goto('/admin/team');
  await expect(page.locator('.admin-section-header-title', { hasText: 'Team' })).toBeVisible();
  await hideToolbar(page);
  for (const width of WIDTHS) {
    await shotHeader(page, 'team', width);
    const metrics = await titleMetrics(page);
    teamLeft[width] = metrics.left;
    teamFont[width] = metrics;
  }

  await page.context().clearCookies();
  await page.goto(`/preview/${seed.ready.token}`);
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.locator('.admin-hub-content')).toBeVisible();
  await hideToolbar(page);

  const pages: Array<{ name: string; path: string; testId: string }> = [
    { name: 'overview', path: '/admin', testId: 'admin-hub-overview' },
    { name: 'changes', path: '/admin/changes', testId: 'admin-hub-changes' },
    { name: 'website', path: '/admin/website', testId: 'admin-hub-website' },
    { name: 'messages', path: '/admin/messages', testId: 'admin-hub-messages' },
  ];

  for (const item of pages) {
    await page.goto(item.path);
    await expect(page.getByTestId(item.testId)).toBeVisible();
    await expect(page.locator('h1.sr-only', { hasText: 'Kersivo Admin Panel' })).toHaveCount(1);
    await expect(page.locator('.admin-hub-head')).toHaveCount(0);
    await expect(page.locator('.admin-section-header')).toHaveCount(1);
    await hideToolbar(page);
    for (const width of WIDTHS) {
      await shotHeader(page, item.name, width);
      const metrics = await titleMetrics(page);
      expect(metrics.left, `${item.name} left@${width}`).toBe(teamLeft[width]);
      expect(metrics.fontFamily, `${item.name} font@${width}`).toBe(teamFont[width].fontFamily);
      expect(metrics.fontSize, `${item.name} size@${width}`).toBe(teamFont[width].fontSize);
      expect(metrics.fontWeight, `${item.name} weight@${width}`).toBe(teamFont[width].fontWeight);
      expect(metrics.color, `${item.name} colour@${width}`).toBe(teamFont[width].color);
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin');
  await expect(page.getByTestId('admin-mobile-fab')).toBeVisible();
  await expect(page.getByTestId('admin-hub-add')).toBeHidden();
});
