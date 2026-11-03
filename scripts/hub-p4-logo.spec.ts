import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const shotDir =
  process.platform === 'win32'
    ? 'C:/tmp/kersivo-shots/hub-p4-logo-consistency'
    : '/tmp/kersivo-shots/hub-p4-logo-consistency';
mkdirSync(shotDir, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';

type Seed = {
  ops: { email: string; password: string };
  requested: { id: string; token: string };
  ready: { id: string; token: string };
  paidDirect: { shopId: string | null; owner: { email: string; password: string } };
};

let seed: Seed;

async function signIn(page: Page, email: string, password: string) {
  const res = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    data: { email, password },
  });
  expect(res.ok(), `sign-in ${email} ${res.status()}`).toBeTruthy();
}

async function openHub(page: Page, token: string) {
  const response = await page.goto(`/preview/${token}`);
  expect(response, `/preview/${token}`).not.toBeNull();
  await expect(page.locator('.admin-shell')).toBeVisible();
}

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === 'ks_hub');
  expect(cookie, 'ks_hub cookie').toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

type LogoAsset = { id: string; kind: string };

async function listLogos(page: Page): Promise<LogoAsset[]> {
  const res = await page.request.get('/api/admin-hub/assets', { headers: await hubHeaders(page) });
  expect(res.ok(), `list assets ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { assets?: LogoAsset[] };
  return (body.assets ?? []).filter((asset) => asset.kind === 'LOGO');
}

async function deleteLogos(page: Page) {
  for (const asset of await listLogos(page)) {
    const res = await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, {
      headers: await hubHeaders(page),
    });
    expect(res.ok(), `delete ${asset.id} ${res.status()}`).toBeTruthy();
  }
}

async function uploadLogo(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<LogoAsset> {
  const res = await page.request.post('/api/admin-hub/assets', {
    headers: await hubHeaders(page),
    multipart: {
      kind: 'LOGO',
      file: { name, mimeType, buffer },
    },
  });
  const body = (await res.json()) as { asset?: LogoAsset; error?: string };
  expect(res.ok(), `upload ${name} ${res.status()} ${body.error ?? ''}`).toBeTruthy();
  expect(body.asset?.id).toBeTruthy();
  return body.asset!;
}

async function markPng(width: number, height: number, colour: { r: number; g: number; b: number; alpha?: number }) {
  const overlay = await sharp({
    create: {
      width: Math.max(24, Math.round(width * 0.08)),
      height: Math.max(24, Math.round(height * 0.08)),
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width, height, channels: 4, background: { r: colour.r, g: colour.g, b: colour.b, alpha: colour.alpha ?? 1 } },
  })
    .composite([
      { input: overlay, gravity: 'northwest' },
      { input: overlay, gravity: 'northeast' },
      { input: overlay, gravity: 'southwest' },
      { input: overlay, gravity: 'southeast' },
    ])
    .png()
    .toBuffer();
}

function wordmarkSvg() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="none"/>
      <text x="40" y="160" font-size="120" font-family="Arial, sans-serif" fill="#F4F4F5">NORTHGATE</text>
    </svg>`,
    'utf8',
  );
}

async function expectLogoSrc(page: Page, assetId: string, label: string) {
  await page.reload();
  await expect(page.locator('.admin-shell')).toBeVisible();
  const needle = `/assets/${assetId}`;
  const sidebar = page.locator('.admin-sidebar .admin-sidebar-logo-img, .admin-mobile-header .admin-sidebar-logo-img');
  await expect(sidebar.first(), label).toHaveAttribute('src', new RegExp(needle));
  const mini = page.locator('[data-tile="colours"] .admin-hub-logo-mini__mark img');
  if (await mini.count()) {
    await expect(mini, `${label} mini`).toHaveAttribute('src', new RegExp(needle));
  }
  const phone = page.locator('.admin-hub-phone__logo');
  if (await phone.count()) {
    await expect(phone, `${label} phone`).toHaveAttribute('src', new RegExp(needle));
  }
}

async function expectContain(page: Page, selector: string) {
  const fit = await page.locator(selector).first().evaluate((el) => getComputedStyle(el).objectFit);
  expect(fit, selector).toBe('contain');
}

async function shot(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: width <= 375 ? 812 : 900 });
  await page.screenshot({ path: join(shotDir, `${name}-${width}.png`), fullPage: true });
}

test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/preview-hub-qa/seed');
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test('newest upload is current everywhere, contain never crops, Current logo label', async ({ page }) => {
  await openHub(page, seed.requested.token);
  await deleteLogos(page);

  const wide = await markPng(1200, 300, { r: 215, g: 38, b: 56 });
  const logoA = await uploadLogo(page, 'wide.png', 'image/png', wide);
  await expectLogoSrc(page, logoA.id, 'wide A');
  await shot(page, 'overview-wide', 375);
  await shot(page, 'overview-wide', 1440);

  const tall = await markPng(300, 1200, { r: 31, g: 111, b: 107 });
  const logoB = await uploadLogo(page, 'tall.png', 'image/png', tall);
  await expectLogoSrc(page, logoB.id, 'tall B');
  await expectContain(page, '.admin-sidebar-logo-img');
  await expectContain(page, '.admin-hub-logo-mini__mark img');
  const miniPad = await page.locator('.admin-hub-logo-mini__mark img').evaluate((el) => getComputedStyle(el).padding);
  expect(miniPad).toBe('4px');
  expect(await page.locator('.admin-hub-logo-mini__mark.admin-hub-skel').count()).toBe(0);
  await shot(page, 'overview-tall', 375);
  await shot(page, 'overview-tall', 1440);

  await page.goto('/admin?app=logo');
  await expect(page.getByTestId('admin-hub-app')).toBeVisible();
  await expect(page.getByText('Current logo')).toBeVisible();
  await expect(page.locator('[data-testid="hub-logo-current"] img')).toHaveAttribute(
    'src',
    new RegExp(`/assets/${logoB.id}`),
  );
  await shot(page, 'app-logo', 375);
  await shot(page, 'app-logo', 1440);

  await page.goto('/admin?app=colours');
  await expect(page.getByTestId('admin-hub-app')).toBeVisible();
  // O7: the test id sits on the one logo <img> itself.
  await expect(page.getByTestId('admin-hub-colours-logo')).toHaveAttribute(
    'src',
    new RegExp(`/assets/${logoB.id}`),
  );
  await shot(page, 'app-colours', 375);
  await shot(page, 'app-colours', 1440);

  const delB = await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(logoB.id)}`, {
    headers: await hubHeaders(page),
  });
  expect(delB.ok(), `delete B ${delB.status()}`).toBeTruthy();
  await page.goto('/admin');
  await expectLogoSrc(page, logoA.id, 'after delete B');

  const square = await markPng(400, 400, { r: 201, g: 162, b: 74 });
  const logoSquare = await uploadLogo(page, 'square.png', 'image/png', square);
  await expectLogoSrc(page, logoSquare.id, 'square');
  await shot(page, 'overview-square', 375);
  await shot(page, 'overview-square', 1440);

  await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(logoSquare.id)}`, {
    headers: await hubHeaders(page),
  });
  const transparent = await markPng(800, 400, { r: 244, g: 244, b: 245, alpha: 0 });
  const logoClear = await uploadLogo(page, 'clear.png', 'image/png', transparent);
  await expectLogoSrc(page, logoClear.id, 'transparent');
  await shot(page, 'overview-transparent', 375);
  await shot(page, 'overview-transparent', 1440);

  await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(logoClear.id)}`, {
    headers: await hubHeaders(page),
  });
  const logoSvg = await uploadLogo(page, 'wordmark.svg', 'image/svg+xml', wordmarkSvg());
  await expectLogoSrc(page, logoSvg.id, 'svg');
  await shot(page, 'overview-svg', 375);
  await shot(page, 'overview-svg', 1440);
});

test('paid /admin uses contain for a custom sidebar logo', async ({ page }) => {
  await signIn(page, seed.paidDirect.owner.email, seed.paidDirect.owner.password);
  await page.goto('/admin');
  await expect(page.locator('.admin-shell')).toBeVisible();
  await expectContain(page, '.admin-sidebar-logo-img');
  await shot(page, 'paid-admin', 375);
  await shot(page, 'paid-admin', 1440);
});
