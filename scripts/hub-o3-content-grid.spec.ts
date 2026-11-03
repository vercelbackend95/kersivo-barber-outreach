/**
 * Hub O3: Website content tile — logo slot + adaptive photo grid. Screenshot matrix for both Overview
 * stages (without / with the Changes tile), never-cropped logos, "+N", CLS, axe and the live refresh.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { Prisma, PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const shotDir =
  process.platform === 'win32' ? 'C:/tmp/kersivo-shots/hub-o3-content-grid' : '/tmp/kersivo-shots/hub-o3-content-grid';
mkdirSync(shotDir, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error('hub-o3 QA must use a local database');

const WIDTHS = [375, 768, 1024, 1280, 1440] as const;
type Seed = { requested: { id: string; token: string }; ready: { id: string; token: string } };
type StageKey = 'requested' | 'ready';
let seed: Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

// ───────── fixtures (generated, labelled so any crop is obvious) ─────────
async function svgPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function svgJpeg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}
const PHOTO_TINTS = ['#3b4a5a', '#5a3b3b', '#3b5a45', '#5a523b', '#4a3b5a', '#3b585a', '#5a453b', '#2f3a4d', '#4d2f3a', '#3a4d2f', '#4d452f'];
function photoSvg(index: number, width: number, height: number) {
  const tint = PHOTO_TINTS[index % PHOTO_TINTS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#111"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="#e8e8e8" stroke-width="10" stroke-dasharray="40 20"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 5}" fill="none" stroke="#fff" stroke-width="8"/>
    <text x="50%" y="50%" font-family="Arial" font-weight="700" font-size="${Math.min(width, height) / 6}" fill="#fff" text-anchor="middle" dominant-baseline="middle">${index + 1}</text>
  </svg>`;
}
const landscape = (i: number) => svgJpeg(photoSvg(i, 1600, 1067));
const portrait = (i: number) => svgJpeg(photoSvg(i, 1067, 1600));

const LOGOS = {
  // Red mark + light text on a transparent background.
  transparent: () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <circle cx="300" cy="240" r="170" fill="#C8102E"/><text x="300" y="262" font-family="Arial" font-weight="700" font-size="120" fill="#fff" text-anchor="middle">FR</text>
      <text x="300" y="540" font-family="Arial" font-weight="700" font-size="64" fill="#F4F4F5" text-anchor="middle">FADE ROOM</text></svg>`),
  wordmark: () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200">
      <rect x="2" y="2" width="1196" height="196" fill="none" stroke="#C9A24A" stroke-width="4"/>
      <text x="600" y="128" font-family="Arial" font-weight="700" font-size="84" fill="#F2E8D5" text-anchor="middle" letter-spacing="4">FADE ROOM BARBERS</text></svg>`),
  tall: () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900">
      <rect x="4" y="4" width="292" height="892" fill="none" stroke="#1F6F6B" stroke-width="8"/>
      <circle cx="150" cy="150" r="110" fill="#1F6F6B"/><rect x="60" y="320" width="180" height="480" rx="20" fill="#C9A24A"/></svg>`),
  dark: () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
      <rect x="40" y="60" width="280" height="280" rx="40" fill="#0b0b0b"/>
      <text x="560" y="230" font-family="Arial" font-weight="700" font-size="110" fill="#111" text-anchor="middle">CUTS</text></svg>`),
};

// ───────── helpers ─────────
async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === 'ks_hub');
  expect(cookie, 'ks_hub cookie').toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function upload(page: Page, kind: string, name: string, buffer: Buffer, mimeType: string) {
  // Local QA database only (asserted above): the fixture matrix uploads far more than an owner would.
  await prisma.rateLimitEvent.deleteMany({});
  const res = await page.request.post('/api/admin-hub/assets', {
    headers: await hubHeaders(page),
    multipart: { kind, file: { name, mimeType, buffer } },
  });
  expect(res.ok(), `upload ${name} ${res.status()} ${await res.text().catch(() => '')}`).toBeTruthy();
  return ((await res.json()) as { asset: { id: string } }).asset;
}

async function clearShop(page: Page, stage: StageKey) {
  await prisma.rateLimitEvent.deleteMany({});
  await prisma.previewRequest.update({
    where: { id: seed[stage].id },
    data: { brandColoursSentAt: null, brandSubmittedSnapshot: Prisma.DbNull, aboutText: 'We cut hair in Leeds.' },
  });
  const res = await page.request.get('/api/admin-hub/assets', { headers: await hubHeaders(page) });
  const { assets = [] } = (await res.json()) as { assets?: Array<{ id: string }> };
  for (const asset of assets) {
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, { headers: await hubHeaders(page) });
  }
}

type Scenario = {
  name: string;
  logo: keyof typeof LOGOS | null;
  photos: Array<'l' | 'p'>;
};
const SCENARIOS: Scenario[] = [
  { name: 'logo-only', logo: 'transparent', photos: [] },
  { name: 'logo-1-photo', logo: 'transparent', photos: ['l'] },
  { name: 'logo-2-photos', logo: 'transparent', photos: ['l', 'l'] },
  { name: 'logo-3-photos', logo: 'transparent', photos: ['l', 'l', 'l'] },
  { name: 'logo-4-photos', logo: 'transparent', photos: ['l', 'l', 'l', 'l'] },
  { name: 'logo-9-photos', logo: 'transparent', photos: ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'] },
  { name: 'mixed-portrait-landscape', logo: 'tall', photos: ['p', 'l', 'p', 'l', 'p'] },
  { name: 'wordmark-logo', logo: 'wordmark', photos: ['l', 'p', 'l'] },
  { name: 'dark-logo', logo: 'dark', photos: ['l', 'l'] },
];

async function applyScenario(page: Page, stage: StageKey, scenario: Scenario) {
  await clearShop(page, stage);
  for (const [index, kind] of scenario.photos.entries()) {
    const buffer = kind === 'l' ? await landscape(index) : await portrait(index);
    await upload(page, 'SHOP_PHOTO', `photo-${index + 1}.jpg`, buffer, 'image/jpeg');
  }
  if (scenario.logo) await upload(page, 'LOGO', `logo-${scenario.logo}.png`, await LOGOS[scenario.logo](), 'image/png');
}

const CLS_INIT = () => {
  (window as unknown as { __cls: number }).__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
      if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });
};

async function stagePage(browser: Browser, stage: StageKey) {
  const context = await browser.newContext();
  await context.addInitScript(CLS_INIT);
  const page = await context.newPage();
  await page.goto(`/preview/${seed[stage].token}`);
  await expect(page.locator('.admin-shell')).toBeVisible();
  return page;
}

async function openOverview(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await page.goto('/admin');
  await expect(page.getByTestId('admin-hub-overview')).toBeVisible();
  const tile = page.getByTestId('admin-hub-content-tile');
  await tile.scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  // Lazy images: wait until every visible image in the tile has decoded.
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>('[data-testid="admin-hub-content-tile"] img')).every(
      (img) => !img.checkVisibility() || (img.complete && img.naturalWidth > 0),
    ),
  );
  await page.waitForTimeout(250);
  return tile;
}

/** The logo is contained in its link (no box since O7): never cropped, never upscaled, aspect ratio kept. */
async function assertLogoContained(page: Page) {
  const logo = page.getByTestId('admin-hub-content-logo');
  await expect(logo).toBeVisible();
  const m = await logo.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const img = el.querySelector('img')!;
    const r = img.getBoundingClientRect();
    return {
      box: { l: box.left, t: box.top, r: box.right, b: box.bottom, w: box.width },
      img: { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height },
      natural: { w: img.naturalWidth, h: img.naturalHeight },
      fit: getComputedStyle(img).objectFit,
      surface: getComputedStyle(img).backgroundColor,
      light: img.classList.contains('hub-logo-mark--plate'),
    };
  });
  expect(m.img.l).toBeGreaterThanOrEqual(m.box.l);
  expect(m.img.t).toBeGreaterThanOrEqual(m.box.t);
  expect(m.img.r).toBeLessThanOrEqual(m.box.r + 0.5);
  expect(m.img.b).toBeLessThanOrEqual(m.box.b + 0.5);
  expect(m.img.w).toBeLessThanOrEqual(m.natural.w + 0.5);
  expect(Math.abs(m.img.w / m.img.h - m.natural.w / m.natural.h)).toBeLessThan(0.05);
  return m;
}

const findings: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/preview-hub-qa/seed');
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  console.log(`\n[hub-o3] findings\n${findings.join('\n')}`);
  await prisma.$disconnect();
});

for (const stage of ['requested', 'ready'] as StageKey[]) {
  test(`content tile matrix — ${stage === 'ready' ? 'with Changes' : 'without Changes'}`, async ({ browser }) => {
    const page = await stagePage(browser, stage);
    for (const scenario of SCENARIOS) {
      await applyScenario(page, stage, scenario);
      for (const width of WIDTHS) {
        const tile = await openOverview(page, width);
        const photos = tile.getByTestId('admin-hub-content-photos');
        if (scenario.photos.length) {
          await expect(photos).toHaveAttribute('data-count', String(Math.min(8, scenario.photos.length)));
        } else {
          await expect(photos).toHaveCount(0);
        }
        const logo = await assertLogoContained(page);
        if (scenario.logo === 'dark') expect(logo.light, 'dark logo gets the light plate').toBe(true);
        if (scenario.logo === 'transparent') expect(logo.light).toBe(false);

        // Visible cells and "+N".
        const layout = await tile.evaluate((el) => {
          const cells = Array.from(el.querySelectorAll<HTMLElement>('[data-testid="admin-hub-content-photos"] > li')).filter(
            (li) => li.checkVisibility(),
          );
          const more = cells
            .map((li) => li.querySelector<HTMLElement>('.admin-hub-photo__more'))
            .find((node) => node && node.checkVisibility());
          const columns = new Set(cells.map((li) => Math.round(li.getBoundingClientRect().left))).size;
          const photosWrap = el.querySelector('.admin-hub-content-photos');
          return {
            visible: cells.length,
            columns,
            more: more?.textContent ?? null,
            gridWidth: photosWrap ? Math.round(photosWrap.getBoundingClientRect().width) : 0,
            bodyWidth: Math.round(el.querySelector('.admin-hub-content-body')!.getBoundingClientRect().width),
          };
        });
        if (scenario.photos.length >= 4) {
          const expected = layout.bodyWidth < 420 ? 4 : layout.bodyWidth <= 720 ? 6 : 8;
          expect(layout.visible).toBe(Math.min(expected, scenario.photos.length));
          if (scenario.photos.length > layout.visible) {
            const n = scenario.photos.length - layout.visible;
            expect(layout.more).toContain(`+${n}`);
            const lastLink = tile.locator('[data-testid="admin-hub-content-photos"] > li:visible a').last();
            await expect(lastLink).toHaveAccessibleName(`Show all ${scenario.photos.length} shop photos`);
            await expect(lastLink).toHaveAttribute('href', '/admin?app=materials&item=photos');
          }
        }
        findings.push(
          `${stage} ${scenario.name} @${width}: body ${layout.bodyWidth}px, grid ${layout.gridWidth}px, ${layout.visible} cells / ${layout.columns} cols${layout.more ? `, more ${layout.more}` : ''}, logo ${Math.round(logo.box.w)}px${logo.light ? ' (light plate)' : ''}`,
        );

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `no horizontal scroll ${scenario.name} @${width}`).toBeLessThanOrEqual(0);
        const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
        expect(cls, `CLS ${scenario.name} @${width}`).toBeLessThan(0.05);

        const base = `${stage === 'ready' ? 'with-changes' : 'no-changes'}-${scenario.name}-${width}`;
        await tile.screenshot({ path: join(shotDir, `tile-${base}.png`) });
        if (scenario.name === 'logo-9-photos' || scenario.name === 'logo-3-photos') {
          await page.screenshot({ path: join(shotDir, `page-${base}.png`), fullPage: true });
        }
      }
      // axe on the tile once per scenario (1440 + 375).
      for (const width of [1440, 375]) {
        await openOverview(page, width);
        const axe = await new AxeBuilder({ page })
          .include('[data-testid="admin-hub-content-tile"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), `axe ${scenario.name} @${width}`).toEqual([]);
      }
    }
    await page.context().close();
  });
}

test('keyboard: photo cells tab in order and "+N" is the last grid stop; focus is visible', async ({ browser }) => {
  const page = await stagePage(browser, 'requested');
  await applyScenario(page, 'requested', SCENARIOS.find((s) => s.name === 'logo-9-photos')!);
  const tile = await openOverview(page, 1440);
  const logo = tile.getByTestId('admin-hub-content-logo');
  await logo.focus();
  const order: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return {
        cls: el.className,
        name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
        outline: cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px',
      };
    });
    order.push(`${info.cls}|${info.name}`);
    if (info.cls.includes('admin-hub-photo__link')) expect(info.outline, 'focus ring on photo cell').toBe(true);
    if (!info.cls.includes('admin-hub-photo__link')) break;
  }
  const photoStops = order.filter((row) => row.includes('admin-hub-photo__link'));
  expect(photoStops.at(-1)).toContain('Show all 9 shop photos');
  await page.keyboard.press('Shift+Tab');
  await page.screenshot({ path: join(shotDir, 'keyboard-focus-more-1440.png'), clip: (await tile.boundingBox())! });
  await page.context().close();
});

for (const width of [1440, 375]) {
  test(`live: photo upload / delete and new logo update the tile without reload at ${width}px`, async ({ browser }) => {
    const page = await stagePage(browser, 'requested');
    await applyScenario(page, 'requested', { name: 'live', logo: 'transparent', photos: ['l', 'l'] });
    const tile = await openOverview(page, width);
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    const photos = tile.getByTestId('admin-hub-content-photos');
    await expect(photos).toHaveAttribute('data-count', '2');
    const logoBefore = await tile.getByTestId('admin-hub-content-logo').locator('img').getAttribute('src');
    await page.screenshot({ path: join(shotDir, `live-0-before-${width}.png`), fullPage: width === 375 });

    const app = page.getByTestId('admin-hub-app');
    const close = async () => {
      await app.getByRole('button', { name: 'Close' }).click();
      await expect(app).toHaveCount(0);
    };

    // 1) Upload a photo.
    await tile.locator('[data-content-item="photos"]').click();
    await app.locator('#photos input[type="file"][data-testid="hub-upload-shop_photo"]').setInputFiles({
      name: 'new-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: await portrait(7),
    });
    await expect(app.locator('#photos .hub-photo')).toHaveCount(3, { timeout: 20000 });
    await close();
    await expect(photos).toHaveAttribute('data-count', '3');
    await expect(photos).toHaveClass(/admin-hub-photos--three/);
    await expect(photos.locator('li').first()).toHaveClass(/admin-hub-thumb--new/);
    await page.screenshot({ path: join(shotDir, `live-1-photo-added-${width}.png`), fullPage: width === 375 });

    // 2) Delete a photo.
    await tile.locator('[data-content-item="photos"]').click();
    await app.locator('#photos .hub-photo').first().getByRole('button', { name: 'Delete' }).click();
    await close();
    await expect(photos).toHaveAttribute('data-count', '2');
    await page.screenshot({ path: join(shotDir, `live-2-photo-deleted-${width}.png`), fullPage: width === 375 });

    // 3) Upload a new logo (the wide wordmark).
    await tile.locator('[data-content-item="logo"]').click();
    await app.locator('#logo input[type="file"][data-testid="hub-upload-logo"]').setInputFiles({
      name: 'wordmark.png',
      mimeType: 'image/png',
      buffer: await LOGOS.wordmark(),
    });
    await expect(app.locator('[data-testid="hub-logo-current"]')).toBeVisible({ timeout: 20000 });
    await close();
    const logoImg = tile.getByTestId('admin-hub-content-logo').locator('img');
    await expect(logoImg).not.toHaveAttribute('src', logoBefore!);
    await page.waitForFunction(() => {
      const img = document.querySelector<HTMLImageElement>('[data-testid="admin-hub-content-logo"] img');
      return Boolean(img?.complete && img.naturalWidth);
    });
    const m = await assertLogoContained(page);
    expect(m.natural.w / m.natural.h).toBeGreaterThan(5);
    await page.screenshot({ path: join(shotDir, `live-3-logo-replaced-${width}.png`), fullPage: width === 375 });

    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    await page.context().close();
  });
}

test('reduced motion: new photos do not animate', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(CLS_INIT);
  const page = await context.newPage();
  await page.goto(`/preview/${seed.requested.token}`);
  await applyScenario(page, 'requested', { name: 'rm', logo: null, photos: ['l'] });
  const tile = await openOverview(page, 1440);
  await tile.evaluate((el) => {
    el.querySelector('[data-testid="admin-hub-content-photos"] li')?.classList.add('admin-hub-thumb--new');
  });
  const animation = await tile.locator('[data-testid="admin-hub-content-photos"] li img').first().evaluate((img) => getComputedStyle(img).animationName);
  expect(animation).toBe('none');
  await context.close();
});
