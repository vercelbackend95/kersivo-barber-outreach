/**
 * Captures marketing JPEGs for feature261 bento (Playwright).
 * Prereq: `npm run dev` on 127.0.0.1:4321
 * Required for admin shots: ADMIN_SECRET (e.g. from .env — do not commit secrets).
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'hero-assets', 'screens');

const base = process.env.FEATURE261_SCREEN_BASE ?? 'http://127.0.0.1:4321';
const adminSecret = (process.env.ADMIN_SECRET ?? '').trim();

const LS_KEY = 'kersivo.admin.secret';

async function ensureAdminSession(page) {
  if (!adminSecret) {
    throw new Error('ADMIN_SECRET is required to capture admin screenshots (set env var).');
  }

  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(
    ([key, secret]) => {
      localStorage.setItem(key, secret);
    },
    [LS_KEY, adminSecret],
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });

  const sidebar = page.locator('aside.admin-sidebar');
  try {
    await sidebar.first().waitFor({ state: 'visible', timeout: 12000 });
  } catch {
    const input = page.locator('#admin-secret-input');
    if ((await input.count()) > 0) {
      await input.fill(adminSecret);
      await page.locator('button.admin-login-submit').click();
      await sidebar.first().waitFor({ state: 'visible', timeout: 25000 });
    } else {
      throw new Error('Could not unlock admin (no sidebar, no login form).');
    }
  }

  await page.waitForTimeout(800);
}

async function captureAdminSection(page, section, fileName, settleMs) {
  const url = `${base}/admin?section=${section}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('aside.admin-sidebar').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(settleMs);
  await page.screenshot({
    path: join(outDir, fileName),
    type: 'jpeg',
    quality: 90,
    fullPage: false,
  });
}

async function capturePublic(page, pathSuffix, fileName, settleMs) {
  const url = `${base}${pathSuffix}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(settleMs);
  await page.screenshot({
    path: join(outDir, fileName),
    type: 'jpeg',
    quality: 90,
    fullPage: false,
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1520, height: 920 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  process.stderr.write('Unlocking admin session …\n');
  await ensureAdminSession(page);

  process.stderr.write('Capturing feature261-bookings-dashboard.jpg (admin) …\n');
  await captureAdminSection(page, 'bookings_dashboard', 'feature261-bookings-dashboard.jpg', 4200);

  process.stderr.write('Capturing feature261-barbers.jpg (admin) …\n');
  await captureAdminSection(page, 'bookings_blocks', 'feature261-barbers.jpg', 4200);

  process.stderr.write('Capturing feature261-services.jpg (admin) …\n');
  await captureAdminSection(page, 'services', 'feature261-services.jpg', 4200);

  process.stderr.write('Capturing feature261-shop-admin.jpg (admin retail) …\n');
  await captureAdminSection(page, 'shop_products', 'feature261-shop-admin.jpg', 4200);

  process.stderr.write('Capturing feature261-booking-flow.jpg (/book) …\n');
  await capturePublic(page, '/book', 'feature261-booking-flow.jpg', 4500);

  process.stderr.write('Capturing feature261-shop-storefront.jpg (/shop) …\n');
  await capturePublic(page, '/shop', 'feature261-shop-storefront.jpg', 4500);

  await browser.close();
  process.stderr.write(`Done. Files in ${outDir}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
