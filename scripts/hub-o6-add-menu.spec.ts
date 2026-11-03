/**
 * Hub O6: the desktop Add menu is portaled to document.body with fixed positioning, so it is never painted under
 * the Website content tile's photos / logo and never clipped by the tile. Checks the tile "+" and the header Add at
 * 768–1440 px (on top via elementFromPoint, inside the viewport, flips above near the bottom), the mobile sheet,
 * console errors and axe on the open menu. HUB_O6_PHASE=before only takes screenshots.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { Prisma, PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const PHASE = process.env.HUB_O6_PHASE === 'before' ? 'before' : 'after';
const CHECK = PHASE === 'after';
const shotDir = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/hub-o6' : '/tmp/kersivo-shots/hub-o6';
mkdirSync(shotDir, { recursive: true });

const ORIGIN = 'http://127.0.0.1:4397';
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || 'postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error('hub-o6 QA must use a local database');

const WIDTHS = [375, 768, 1024, 1280, 1440] as const;
const MARGIN = 12;
type Seed = { requested: { id: string; token: string }; ready: { id: string; token: string } };
let seed: Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const photo = (index: number) =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067">
      <rect width="100%" height="100%" fill="${['#3b4a5a', '#5a3b3b', '#3b5a45', '#5a523b', '#4a3b5a'][index % 5]}"/>
      <text x="50%" y="50%" font-family="Arial" font-weight="700" font-size="300" fill="#fff" text-anchor="middle" dominant-baseline="middle">${index + 1}</text></svg>`),
  )
    .jpeg({ quality: 80 })
    .toBuffer();
const logo = () =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <circle cx="300" cy="260" r="200" fill="#C8102E"/><text x="300" y="300" font-family="Arial" font-weight="700" font-size="140" fill="#fff" text-anchor="middle">FR</text></svg>`),
  )
    .png()
    .toBuffer();

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === 'ks_hub');
  expect(cookie, 'ks_hub cookie').toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function upload(page: Page, kind: string, name: string, buffer: Buffer, mimeType: string) {
  await prisma.rateLimitEvent.deleteMany({});
  const res = await page.request.post('/api/admin-hub/assets', {
    headers: await hubHeaders(page),
    multipart: { kind, file: { name, mimeType, buffer } },
  });
  expect(res.ok(), `upload ${name} ${res.status()}`).toBeTruthy();
}

async function seedContent(page: Page) {
  await prisma.rateLimitEvent.deleteMany({});
  await prisma.previewRequest.update({
    where: { id: seed.ready.id },
    data: { brandColoursSentAt: null, brandSubmittedSnapshot: Prisma.DbNull, aboutText: 'We cut hair in Leeds.' },
  });
  const res = await page.request.get('/api/admin-hub/assets', { headers: await hubHeaders(page) });
  const { assets = [] } = (await res.json()) as { assets?: Array<{ id: string }> };
  for (const asset of assets) {
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, { headers: await hubHeaders(page) });
  }
  for (let i = 0; i < 5; i += 1) await upload(page, 'SHOP_PHOTO', `photo-${i + 1}.jpg`, await photo(i), 'image/jpeg');
  await upload(page, 'LOGO', 'logo.png', await logo(), 'image/png');
}

async function openOverview(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await page.goto('/admin');
  await expect(page.getByTestId('admin-hub-overview')).toBeVisible({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>('[data-testid="admin-hub-content-tile"] img')).every(
      (img) => !img.checkVisibility() || (img.complete && img.naturalWidth > 0),
    ),
  );
}

/** Panel is a child of body, fully inside the viewport (12 px margin) and the topmost element across its area. */
async function assertOnTop(page: Page, panel: Locator) {
  const m = await panel.evaluate((el, margin) => {
    const r = el.getBoundingClientRect();
    const probes = [
      [0.5, 0.5],
      [0.1, 0.1],
      [0.9, 0.1],
      [0.1, 0.9],
      [0.9, 0.9],
      [0.5, 0.25],
      [0.5, 0.75],
    ].map(([fx, fy]) => {
      const hit = document.elementFromPoint(r.left + r.width * fx!, r.top + r.height * fy!);
      return Boolean(hit && el.contains(hit));
    });
    return {
      parentIsBody: el.parentElement === document.body,
      position: getComputedStyle(el).position,
      inside:
        r.left >= margin - 0.5 &&
        r.top >= margin - 0.5 &&
        r.right <= window.innerWidth - margin + 0.5 &&
        r.bottom <= window.innerHeight - margin + 0.5,
      scrollable: el.scrollHeight <= el.clientHeight + 1 || getComputedStyle(el).overflowY === 'auto',
      probes,
      rect: { t: r.top, b: r.bottom, l: r.left, r: r.right },
    };
  }, MARGIN);
  expect(m.parentIsBody, 'panel portaled to body').toBe(true);
  expect(m.position).toBe('fixed');
  expect(m.inside, `panel inside viewport ${JSON.stringify(m.rect)}`).toBe(true);
  expect(m.scrollable).toBe(true);
  expect(m.probes, 'elementFromPoint hits the panel').toEqual(m.probes.map(() => true));
  return m.rect;
}

const consoleErrors: string[] = [];
const failedResponses: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/preview-hub-qa/seed');
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test(`add menu layering — ${PHASE}`, async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`);
  });
  await page.goto(`/preview/${seed.ready.token}`);
  await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 90000 });
  await seedContent(page);

  for (const width of WIDTHS) {
    await openOverview(page, width);
    const tile = page.getByTestId('admin-hub-content-tile');
    const trigger = tile.getByTestId('admin-hub-add-inline');
    await tile.scrollIntoViewIfNeeded();
    await trigger.click();

    if (width <= 640) {
      const sheet = page.getByTestId('admin-hub-add-sheet');
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(350);
      await page.screenshot({ path: join(shotDir, `${PHASE}-content-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      continue;
    }

    const panel = page.getByTestId('admin-hub-add-menu');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(shotDir, `${PHASE}-content-${width}.png`) });
    if (CHECK) {
      const rect = await assertOnTop(page, panel);
      const t = (await trigger.boundingBox())!;
      expect(rect.t, 'opens below the trigger').toBeGreaterThanOrEqual(t.y + t.height + 7.5);
      expect(Math.abs(rect.r - (t.x + t.width)), 'right edge aligned with trigger').toBeLessThan(1);
      if (width === 1440) {
        const axe = await new AxeBuilder({ page }).include('[data-testid="admin-hub-add-menu"]').analyze();
        expect(axe.violations.map((v) => v.id)).toEqual([]);
      }
    }
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    if (CHECK) await expect(trigger).toBeFocused();

    // Trigger near the bottom of the viewport → the panel flips above it.
    if (width >= 1024) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="admin-hub-content-tile"] [data-testid="admin-hub-add-inline"]')!;
        const r = el.getBoundingClientRect();
        window.scrollBy(0, r.bottom - (window.innerHeight - 60));
      });
      await page.waitForTimeout(150);
      await trigger.click();
      await expect(panel).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(shotDir, `${PHASE}-content-flip-${width}.png`) });
      if (CHECK) {
        const rect = await assertOnTop(page, panel);
        const t = (await trigger.boundingBox())!;
        expect(rect.b, 'flipped above the trigger').toBeLessThanOrEqual(t.y - 7.5);
        // Scrolling the trigger out of view closes the menu (when the page is tall enough to do that).
        const gone = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="admin-hub-content-tile"] [data-testid="admin-hub-add-inline"]')!;
          window.scrollBy(0, el.getBoundingClientRect().bottom + 10);
          return el.getBoundingClientRect().bottom <= 0;
        });
        if (gone) await expect(panel).toHaveCount(0);
        else await page.keyboard.press('Escape');
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // Header Add (desktop button from 1024, mobile FAB/sheet below).
    await page.evaluate(() => window.scrollTo(0, 0));
    const header = page.getByTestId('admin-hub-add');
    if (await header.isVisible()) {
      await header.click();
      await expect(panel).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(shotDir, `${PHASE}-header-${width}.png`) });
      if (CHECK) {
        await assertOnTop(page, panel);
        // Outside pointerdown closes.
        const blank = await page.evaluate(() => {
          for (let y = 40; y < window.innerHeight; y += 37) {
            for (let x = 4; x < window.innerWidth; x += 53) {
              const el = document.elementFromPoint(x, y);
              if (el && !el.closest('a, button, input, textarea, select, label, [role="menu"], [tabindex]:not([tabindex="-1"])')) return { x, y };
            }
          }
          return null;
        });
        expect(blank, 'a non-interactive point').toBeTruthy();
        await page.mouse.click(blank!.x, blank!.y);
        await expect(panel).toHaveCount(0);
      } else {
        await page.keyboard.press('Escape');
      }
    }
  }

  if (CHECK) {
    // An app opened from a menu item sits above the (now closed) menu; item click closes the menu.
    await openOverview(page, 1440);
    await page.getByTestId('admin-hub-content-tile').getByTestId('admin-hub-add-inline').click();
    await page.getByRole('menuitem', { name: /Shop photos/ }).click();
    await expect(page.getByTestId('admin-hub-add-menu')).toHaveCount(0);
    await expect(page.locator('.admin-hub-app-root')).toBeVisible();
    await page.screenshot({ path: join(shotDir, `${PHASE}-item-opens-app-1440.png`) });
    // Harness noise only: Vite's dev-toolbar "Outdated Optimize Dep" 504 and thumbs of just-uploaded photos
    // (in-memory blob driver) — anything else is a real failure.
    const unexpected = failedResponses.filter((line) => !/dev-toolbar\/entrypoint\.js|[?&]size=thumb/.test(line));
    expect(unexpected, 'failed responses').toEqual([]);
    const relevant = consoleErrors.filter(
      (line) => !/favicon|DevTools|\[vite\]/i.test(line) && !/^Failed to load resource/.test(line),
    );
    expect(relevant, 'console errors').toEqual([]);
  }
  await context.close();
});
