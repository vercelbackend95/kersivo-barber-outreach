/**
 * Hub P7: Overview tiles and app windows read one live store. Every flow below must update the Overview
 * WITHOUT a reload, with exactly one GET /api/admin-hub/state per close-after-change and none otherwise.
 */
import { expect, test, type Page } from '@playwright/test';
import { Prisma, PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const shotDir =
  process.platform === 'win32' ? 'C:/tmp/kersivo-shots/hub-p7-live-state' : '/tmp/kersivo-shots/hub-p7-live-state';
mkdirSync(shotDir, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error('hub-p7 QA must use a local database');

type Seed = { requested: { id: string; token: string } };
let seed: Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === 'ks_hub');
  expect(cookie, 'ks_hub cookie').toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function png(colour: { r: number; g: number; b: number }, size = 400) {
  const mark = await sharp({ create: { width: size / 4, height: size / 4, channels: 4, background: '#F4F4F5' } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...colour, alpha: 1 } } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function upload(page: Page, kind: string, name: string, buffer: Buffer) {
  const res = await page.request.post('/api/admin-hub/assets', {
    headers: await hubHeaders(page),
    multipart: { kind, file: { name, mimeType: 'image/png', buffer } },
  });
  expect(res.ok(), `upload ${name} ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { asset: { id: string } }).asset;
}

/** Fresh, unlocked shop with two photos and no logo / text. */
async function resetShop(page: Page) {
  await prisma.previewRequest.update({
    where: { id: seed.requested.id },
    data: {
      brandColoursSentAt: null,
      brandSubmittedSnapshot: Prisma.DbNull,
      brandPrimaryColour: null,
      brandSecondaryColour: null,
      aboutText: null,
      websiteExtraText: null,
    },
  });
  const res = await page.request.get('/api/admin-hub/assets', { headers: await hubHeaders(page) });
  const { assets = [] } = (await res.json()) as { assets?: Array<{ id: string }> };
  for (const asset of assets) {
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, { headers: await hubHeaders(page) });
  }
  await upload(page, 'SHOP_PHOTO', 'chair.png', await png({ r: 40, g: 40, b: 44 }));
  await upload(page, 'SHOP_PHOTO', 'mirror.png', await png({ r: 90, g: 70, b: 50 }));
}

function stateCounter(page: Page) {
  const counter = { n: 0 };
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/admin-hub/state') counter.n += 1;
  });
  return counter;
}

async function openOverview(page: Page) {
  await page.goto('/admin');
  await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Survives only if the page is never reloaded.
  await page.evaluate(() => ((window as unknown as { __p7NoReload: boolean }).__p7NoReload = true));
}

async function expectNoReload(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { __p7NoReload?: boolean }).__p7NoReload)).toBe(true);
}

async function closeApp(page: Page) {
  await page.getByTestId('admin-hub-app').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('admin-hub-app')).toHaveCount(0);
}

async function shot(page: Page, name: string, width: number) {
  await page.screenshot({ path: join(shotDir, `${name}-${width}.png`), fullPage: true });
}

test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/preview-hub-qa/seed');
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  await prisma.previewRequest
    .update({ where: { id: seed.requested.id }, data: { brandColoursSentAt: null } })
    .catch(() => undefined);
  await prisma.$disconnect();
});

for (const width of [1440, 375]) {
  test(`Overview updates live after app changes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.goto(`/preview/${seed.requested.token}`);
    await expect(page.locator('.admin-shell')).toBeVisible();
    await resetShop(page);
    const gets = stateCounter(page);
    await openOverview(page);
    await shot(page, 'overview-before', width);
    const content = page.getByTestId('admin-hub-content-tile');
    const colours = page.locator('a[data-tile="colours"]');
    await expect(content.locator('[data-content-item="logo"]')).toContainText('Not added');
    await expect(content.locator('[data-testid="admin-hub-content-photos"] li')).toHaveCount(2);

    // Opening and closing without a change costs nothing.
    await content.locator('[data-content-item="logo"]').click();
    await expect(page.getByTestId('admin-hub-app')).toBeVisible();
    await closeApp(page);
    await page.waitForTimeout(400);
    expect(gets.n, 'no GET when nothing changed').toBe(0);

    // 1) Upload a logo in Materials → close → logo ✓ and the colours tile shows it.
    await content.locator('[data-content-item="logo"]').click();
    const app = page.getByTestId('admin-hub-app');
    await app.locator('#logo input[type="file"][data-testid="hub-upload-logo"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: await png({ r: 31, g: 111, b: 107 }),
    });
    await expect(app.locator('[data-testid="hub-logo-current"]')).toBeVisible({ timeout: 20000 });
    if (width === 1440) await shot(page, 'app-materials-logo', width);
    await closeApp(page);
    await expect(content.locator('[data-content-item="logo"]')).toContainText('✓');
    const mini = colours.locator('.admin-hub-logo-mini__mark img');
    await expect(mini).toHaveAttribute('src', /\/api\/admin-hub\/assets\/.+\?size=thumb/);
    await expect(page.locator('.admin-sidebar-logo-img').first()).toHaveAttribute('src', /\/api\/admin-hub\/assets\//);
    await expect(page.getByTestId('admin-hub-overview-live')).toHaveText('Overview updated');
    expect(gets.n, 'one GET after the logo upload').toBe(1);
    await expectNoReload(page);
    await shot(page, 'overview-after-logo', width);

    // 2) Brand colours opens with the new logo and runs extraction on it.
    const logoSrc = (await mini.getAttribute('src'))!;
    const logoId = /assets\/([^?]+)/.exec(logoSrc)![1]!;
    await colours.click();
    await expect(page.getByTestId('admin-hub-colours')).toBeVisible();
    await expect(page.getByTestId('admin-hub-colours-logo').locator('img')).toHaveAttribute('src', new RegExp(logoId));
    // Extraction ran on the new logo (rows sit behind a toggle in the mobile sheet).
    await expect(page.locator('[data-testid^="admin-hub-swatch-"]').first()).toBeAttached({ timeout: 20000 });
    await closeApp(page);
    await page.waitForTimeout(400);
    expect(gets.n, 'no GET after viewing colours').toBe(1);

    // 3) Delete a photo (close inside the undo window: the delete is still committed).
    await content.locator('[data-content-item="photos"]').click();
    await app.locator('#photos .hub-photo').first().getByRole('button', { name: 'Delete' }).click();
    await closeApp(page);
    await expect(content.locator('[data-content-item="photos"]')).toContainText('1');
    await expect(content.locator('[data-testid="admin-hub-content-photos"] li')).toHaveCount(1);
    await page.waitForTimeout(400);
    expect(gets.n, 'one GET after the delete').toBe(2);

    // 4) Save website text.
    await content.locator('[data-content-item="text"]').click();
    await app.locator('#hub-about').fill('Walk-ins welcome. Skin fades and beard trims since 2015.');
    await expect(app.getByText('Saved').first()).toBeVisible({ timeout: 10000 });
    await closeApp(page);
    await expect(content.locator('[data-content-item="text"]')).toContainText('✓');
    expect(gets.n, 'one GET after saving text').toBe(3);

    // 5) Send colours → tile pill "Sent".
    await colours.click();
    // Extraction ran on the new logo (rows sit behind a toggle in the mobile sheet).
    await expect(page.locator('[data-testid^="admin-hub-swatch-"]').first()).toBeAttached({ timeout: 20000 });
    await page.getByRole('button', { name: 'Send colours to KERSIVO' }).click();
    // Keyboard: the Astro dev toolbar (dev server only) sits over the bottom of the mobile sheet.
    await page.getByRole('button', { name: 'Yes, send to KERSIVO' }).press('Enter');
    await expect(page.getByTestId('admin-hub-colours')).toHaveAttribute('data-locked', 'true', { timeout: 15000 });
    await closeApp(page);
    await expect(page.getByTestId('admin-hub-colours-status')).toContainText('Sent');
    await expect(colours).toHaveAttribute('data-locked', 'true');
    await page.waitForTimeout(400);
    expect(gets.n, 'one GET after sending colours').toBe(4);
    await expectNoReload(page);
    await shot(page, 'overview-after', width);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
}

test('Overview has no horizontal scroll at 768 and 1024', async ({ page }) => {
  await page.goto(`/preview/${seed.requested.token}`);
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin');
    await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `no horizontal scroll at ${width}`).toBeLessThanOrEqual(0);
    await shot(page, 'overview-after', width);
  }
});
