/**
 * Captures marketing JPEGs for feature261 bento (Playwright).
 * Prereq: `npm run dev` on 127.0.0.1:4321
 * Required for admin shots: ADMIN_SECRET (e.g. from .env — do not commit secrets).
 *
 * Booking overview timeline: run `npm run seed` first so demo bookings exist.
 * Optional: DEMO_BOOKINGS_DATE or FEATURE261_BOOKING_DATE (YYYY-MM-DD, London calendar day)
 * must match between seed and capture (defaults to today in London when unset).
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

const feature261BookingDate = (process.env.DEMO_BOOKINGS_DATE ?? process.env.FEATURE261_BOOKING_DATE ?? '').trim();
const bookingDateQuery =
  feature261BookingDate && /^\d{4}-\d{2}-\d{2}$/.test(feature261BookingDate)
    ? `&bookingDate=${encodeURIComponent(feature261BookingDate)}`
    : '';

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

/** Bookings dashboard: cropped to timeline chrome + horizontal scroll for busy morning/midday band. */
async function captureBookingsDashboardForFeature261(page) {
  const url = `${base}/admin?section=bookings_dashboard${bookingDateQuery}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('aside.admin-sidebar').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('[data-feature261-booking-overview-shot]').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForTimeout(1200);

  const scroll = page.locator('.admin-timeline-scroll').first();
  const scrollCount = await scroll.count();
  if (scrollCount > 0) {
    await scroll.evaluate((el) => {
      const dayHours = 24 - 8;
      const ratio = (9.5 - 8) / dayHours;
      const anchorPx = ratio * el.scrollWidth;
      const target = anchorPx - el.clientWidth * 0.12;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollLeft = Math.max(0, Math.min(target, max));
    });
    await page.waitForTimeout(500);
  }

  await page.locator('[data-feature261-booking-overview-shot]').screenshot({
    path: join(outDir, 'feature261-bookings-dashboard.jpg'),
    type: 'jpeg',
    quality: 90,
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

  process.stderr.write('Capturing feature261-bookings-dashboard.jpg (admin timeline) …\n');
  await captureBookingsDashboardForFeature261(page);

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
