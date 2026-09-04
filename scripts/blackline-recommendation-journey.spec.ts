import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCREENSHOT_DIR = 'C:\\temp\\smart-retail-phase5a-visual-review';
const BLACKLINE_CART_KEY = 'kersivo_shop_cart_v2:blackline-barbers-demo';

const HAIR_PRODUCT_NAMES = [
  'Matte Clay',
  'Matte Pomade',
  'Fibre Paste',
  'Ironclad Pomade',
  'Forge Styling Powder',
  'Sea Salt Texture Spray',
  'Styling Cream',
  'Barber Wash',
  'Daily Conditioner',
];

const BEARD_PRODUCT_NAMES = [
  'Beard Oil',
  'Beard Balm',
  'Beard Wash',
  'Beard Butter',
  'Moustache Wax',
];

const FACE_SHAVE_NAMES = ['Face Wash', 'Daily Moisturiser', 'Shave Cream', 'Aftershave Balm'];

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function pickFirstAvailableSlot(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const slots = page.locator('button.booking-slot');
    if ((await slots.count()) > 0) {
      await slots.first().click();
      return;
    }
    const dateInput = page.locator('#booking-date');
    const current = await dateInput.inputValue();
    const [year, month, day] = current.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    await dateInput.fill(next.toISOString().slice(0, 10));
    await page.waitForTimeout(250);
  }
  throw new Error('No available BLACKLINE demo slot');
}

async function completeDemoBookingFromBarber(page: Page) {
  await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
  await page.getByRole('radio', { name: /^Ellis Ward$/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await pickFirstAvailableSlot(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/^Name$/i).fill('Alex Demo');
  await page.getByLabel(/^Email$/i).fill('alex@example.com');

  const bookingApiCalls: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (
      /\/api\/bookings\b/.test(url) ||
      /\/api\/public\/recommendations\b/.test(url) ||
      /stripe|resend|sendgrid|openai/i.test(url)
    ) {
      bookingApiCalls.push(url);
    }
  });

  await page.getByRole('button', { name: 'Complete demo booking' }).click();
  await expect(
    page.getByRole('heading', { name: /That’s the Blackline booking experience/i }),
  ).toBeVisible();
  expect(bookingApiCalls).toEqual([]);
}

function recommendationCards(page: Page) {
  return page.locator('.booking-recommendations .sf-card');
}

async function visibleProductNames(page: Page): Promise<string[]> {
  return recommendationCards(page).locator('.sf-card-name').allTextContents();
}

test.describe('BLACKLINE recommendation confirmation journeys', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('Skin Fade confirmation shows rail, Add works, PDP opens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/book?service=skin-fade', { waitUntil: 'domcontentloaded' });
    await completeDemoBookingFromBarber(page);

    const heading = page.getByRole('heading', { name: 'Recommended for your Skin Fade' });
    await expect(heading).toBeVisible();
    await expect(
      page.getByText('Chosen to suit your booking. Add now and collect at your appointment.'),
    ).toBeVisible();

    const cards = recommendationCards(page);
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
    await expect(page.getByText('Matte Clay', { exact: true }).first()).toBeVisible();

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-desktop-1440.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(heading).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const addButtons = page.locator('.booking-recommendations [data-add-to-cart]');
    const addCount = await addButtons.count();
    expect(addCount).toBeGreaterThan(0);
    for (let i = 0; i < addCount; i += 1) {
      const visibility = await addButtons.nth(i).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        const area = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
        const total = Math.max(1, rect.width * rect.height);
        return {
          ratio: area / total,
          left: rect.left,
          right: rect.right,
          width: window.innerWidth,
        };
      });
      if (visibility.ratio < 0.6) continue;
      expect(visibility.left).toBeGreaterThanOrEqual(-2);
      expect(visibility.right).toBeLessThanOrEqual(visibility.width + 2);
    }

    const track = page.locator('.booking-recommendations .product-rail__track');
    const scrollMetrics = await track.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
    if (scrollMetrics.scrollWidth > scrollMetrics.clientWidth + 8) {
      await track.evaluate((node) => {
        node.scrollLeft = Math.min(80, node.scrollWidth - node.clientWidth);
      });
      const after = await track.evaluate((node) => node.scrollLeft);
      expect(after).toBeGreaterThan(0);
    }

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-mobile-390.png'),
      fullPage: true,
    });

    const firstAdd = addButtons.first();
    const productId = await firstAdd.getAttribute('data-product-id');
    expect(productId).toBeTruthy();
    await firstAdd.click();
    await expect
      .poll(async () => (await firstAdd.innerText()).includes('Added'))
      .toBe(true);

    const cart = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{ productId: string }>;
      } catch {
        return [];
      }
    }, BLACKLINE_CART_KEY);
    expect(cart.some((item) => item.productId === productId)).toBe(true);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-mobile-added-state.png'),
      fullPage: true,
    });

    await page.locator(`a.sf-card-hit[href="/demo/shop/${productId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/demo/shop/${productId}`));
    await expect(page.locator('h1, [data-sf-pdp-title]').first()).toBeVisible();
  });

  test('Haircut & Beard rail covers hair and beard without face/shave-only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/book?service=haircut-beard', { waitUntil: 'domcontentloaded' });
    await completeDemoBookingFromBarber(page);

    await expect(
      page.getByRole('heading', { name: 'Recommended for your Haircut & Beard' }),
    ).toBeVisible();

    const names = await visibleProductNames(page);
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names.length).toBeLessThanOrEqual(4);
    expect(names.some((name) => HAIR_PRODUCT_NAMES.includes(name.trim()))).toBe(true);
    expect(names.some((name) => BEARD_PRODUCT_NAMES.includes(name.trim()))).toBe(true);
    for (const banned of FACE_SHAVE_NAMES) {
      expect(names.map((n) => n.trim())).not.toContain(banned);
    }

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'haircut-beard-desktop-1440.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'haircut-beard-mobile-390.png'),
      fullPage: true,
    });
  });
});
