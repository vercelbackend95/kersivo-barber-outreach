import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCREENSHOT_DIR = 'C:\\temp\\booking-confirmation-commerce-review';
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

async function acceptCookiesIfPresent(page: Page) {
  const accept = page.getByRole('button', { name: 'Accept all' });
  if (await accept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await accept.click({ force: true });
    await expect(accept).toBeHidden({ timeout: 5000 }).catch(() => undefined);
  }
  await page.evaluate(() => {
    document.querySelectorAll('[data-astro-transition-persist="ks-cookie"], .cookie-consent').forEach((node) => {
      const el = node as HTMLElement;
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    });
  });
}

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
  await acceptCookiesIfPresent(page);
  await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
  const ellis = page.getByRole('radio', { name: /^Ellis Ward$/i });
  await ellis.click();
  const continueBtn = page.getByRole('button', { name: 'Continue' });
  await expect(continueBtn).toBeEnabled({ timeout: 15000 });
  await continueBtn.click();
  await pickFirstAvailableSlot(page);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 15000 });
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
  await expect(page.getByRole('heading', { name: 'Demo booking complete' })).toBeVisible();
  expect(bookingApiCalls).toEqual([]);
}

function recommendationCards(page: Page) {
  return page.locator('.booking-recommendations .sf-card');
}

async function visibleProductNames(page: Page): Promise<string[]> {
  return recommendationCards(page).locator('.sf-card-name').allTextContents();
}

async function settleConfirmationTop(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const rail = page.locator('.booking-recommendations--confirm');
  if ((await rail.count()) > 0) {
    await expect(rail.first()).toBeVisible();
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

type GeometryMode = 'desktop' | 'mobile' | 'short';

async function readGeometry(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const visibleEnough = (el: Element | null | undefined, minRatio = 0.7) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const visibleWidth = Math.min(r.right, vw) - Math.max(r.left, 0);
      const visibleHeight = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      const area = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
      const total = Math.max(1, r.width * r.height);
      return area / total >= minRatio && r.top < vh - 8 && r.bottom > 8;
    };
    const announce = document.querySelector('.booking-confirmation__announce');
    const pass = document.querySelector('.booking-confirmation__pass');
    const heading = document.querySelector('.booking-recommendations__heading');
    const rail = document.querySelector('.booking-recommendations');
    const card = document.querySelector('.booking-recommendations .sf-card');
    const media = card?.querySelector('.sf-card-media, .sf-media, .product-rail__sf-media');
    const name = card?.querySelector('.sf-card-name, .product-rail__title');
    const price = card?.querySelector('.sf-card-price, .product-rail__price, .shop-price');
    const add = card?.querySelector('[data-add-to-cart]') as HTMLElement | null;
    const nextCard = document.querySelectorAll('.booking-recommendations .sf-card')[1];
    return {
      announceVisible: visibleEnough(announce, 0.55),
      headingVisible: visibleEnough(heading, 0.55),
      mediaVisible: visibleEnough(media, 0.65),
      nameVisible: visibleEnough(name, 0.7),
      priceVisible: visibleEnough(price, 0.7),
      addVisible: visibleEnough(add, 0.7),
      addNotClipped: add
        ? (() => {
            const r = add.getBoundingClientRect();
            return r.left >= -6 && r.right <= vw + 6 && r.bottom <= vh + 8 && r.top >= -6;
          })()
        : false,
      nextCardPartial: nextCard
        ? (() => {
            const r = nextCard.getBoundingClientRect();
            return r.left < vw - 12 && r.right > vw - 48 && r.top < vh && r.bottom > 0;
          })()
        : false,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      announceTop: announce?.getBoundingClientRect().top ?? null,
      passBottom: pass?.getBoundingClientRect().bottom ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      railTop: rail?.getBoundingClientRect().top ?? null,
      addBottom: add?.getBoundingClientRect().bottom ?? null,
      viewportWidth: vw,
      viewportHeight: vh,
    };
  });
}

async function assertAboveTheFoldCommerce(page: Page, mode: GeometryMode) {
  const geometry = await readGeometry(page);

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.announceVisible).toBe(true);

  if (mode === 'short') {
    expect(geometry.headingTop).not.toBeNull();
    expect(geometry.railTop).not.toBeNull();
    expect(geometry.headingTop as number).toBeLessThan(geometry.viewportHeight - 8);
    expect(geometry.railTop as number).toBeLessThan(geometry.viewportHeight - 8);
    return geometry;
  }

  expect(geometry.headingVisible).toBe(true);
  expect(geometry.mediaVisible).toBe(true);
  expect(geometry.nameVisible).toBe(true);
  expect(geometry.priceVisible).toBe(true);
  expect(geometry.addVisible).toBe(true);
  expect(geometry.addNotClipped).toBe(true);

  if (mode === 'mobile') {
    expect(geometry.nextCardPartial).toBe(true);
  }

  return geometry;
}

test.describe('BLACKLINE recommendation confirmation journeys', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('Skin Fade confirmation shows rail, Add works, Bag persists, PDP opens', async ({ page }) => {
    const geometryLog: Record<string, unknown> = {};
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/book?service=skin-fade', { waitUntil: 'domcontentloaded' });
    await acceptCookiesIfPresent(page);
    await completeDemoBookingFromBarber(page);
    await settleConfirmationTop(page);

    await expect(page.locator('[data-sf-header], .sf-header')).toBeVisible();
    await expect(page.locator('.sf-header-brand, .bl-wordmark').first()).toBeVisible();
    const bag = page.locator('[data-sf-bag-button], [data-bl-bag-button]').first();
    await expect(bag).toBeVisible();

    const heading = page.getByRole('heading', { name: 'Picked for your Skin Fade' });
    await expect(heading).toBeVisible();
    await expect(page.getByText('Add now. Collect at your appointment.')).toBeVisible();

    const cards = recommendationCards(page);
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
    await expect(page.getByText('Matte Clay', { exact: true }).first()).toBeVisible();

    geometryLog.desktop1440 = await assertAboveTheFoldCommerce(page, 'desktop');
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-viewport-1440x900.png'),
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await settleConfirmationTop(page);
    await expect(heading).toBeVisible();
    await expect(bag).toBeVisible();
    geometryLog.mobile390 = await assertAboveTheFoldCommerce(page, 'mobile');
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-viewport-390x844.png'),
      fullPage: false,
    });

    await page.setViewportSize({ width: 320, height: 568 });
    await settleConfirmationTop(page);
    geometryLog.short320 = await assertAboveTheFoldCommerce(page, 'short');
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-viewport-320x568.png'),
      fullPage: false,
    });
    writeFileSync(join(SCREENSHOT_DIR, 'geometry-skin-fade.json'), JSON.stringify(geometryLog, null, 2));

    await page.setViewportSize({ width: 390, height: 844 });
    await settleConfirmationTop(page);

    const addButtons = page.locator('.booking-recommendations [data-add-to-cart]');
    const firstAdd = addButtons.first();
    const productId = await firstAdd.getAttribute('data-product-id');
    const productName = (await cards.first().locator('.sf-card-name').innerText()).trim();
    expect(productId).toBeTruthy();
    await firstAdd.click();
    await expect.poll(async () => (await firstAdd.innerText()).includes('Added')).toBe(true);

    const bagCount = page.locator('[data-sf-bag-count], [data-bl-bag-count]').first();
    await expect.poll(async () => Number((await bagCount.innerText()).trim())).toBeGreaterThan(0);

    const cart = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{ productId: string }>;
      } catch {
        return [];
      }
    }, BLACKLINE_CART_KEY);
    expect(cart.some((item) => item.productId === productId)).toBe(true);

    // Toast may appear briefly; Bag must remain available after it clears.
    await page.locator('[data-sf-cart-toast]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
    await expect(bag).toBeVisible();
    await bag.click();
    const drawer = page.locator('[data-sf-cart-panel], [role="dialog"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByText(productName, { exact: true }).first()).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-added-bag-persistent.png'),
      fullPage: false,
    });

    // Close drawer if possible, then open PDP.
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.locator(`a.sf-card-hit[href="/demo/shop/${productId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/demo/shop/${productId}`));
    await expect(page.locator('h1, [data-sf-pdp-title]').first()).toBeVisible();
  });

  test('Haircut & Beard rail covers hair and beard without face/shave-only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/book?service=haircut-beard', { waitUntil: 'domcontentloaded' });
    await acceptCookiesIfPresent(page);
    await completeDemoBookingFromBarber(page);
    await settleConfirmationTop(page);

    await expect(
      page.getByRole('heading', { name: 'Picked for your Haircut & Beard' }),
    ).toBeVisible();

    const names = await visibleProductNames(page);
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names.length).toBeLessThanOrEqual(4);
    expect(names.some((name) => HAIR_PRODUCT_NAMES.includes(name.trim()))).toBe(true);
    expect(names.some((name) => BEARD_PRODUCT_NAMES.includes(name.trim()))).toBe(true);
    for (const banned of FACE_SHAVE_NAMES) {
      expect(names.map((n) => n.trim())).not.toContain(banned);
    }

    await assertAboveTheFoldCommerce(page, 'desktop');
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'haircut-beard-viewport-1440x900.png'),
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await settleConfirmationTop(page);
    await assertAboveTheFoldCommerce(page, 'mobile');
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'haircut-beard-viewport-390x844.png'),
      fullPage: false,
    });
  });

  test('confirmation with no recommendations stays polished without rail chrome', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/book?service=grey-blending', { waitUntil: 'domcontentloaded' });
    await acceptCookiesIfPresent(page);
    await completeDemoBookingFromBarber(page);
    await settleConfirmationTop(page);

    await expect(page.getByRole('heading', { name: 'Demo booking complete' })).toBeVisible();
    await expect(page.locator('.booking-recommendations')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /See your booking on the timeline/i })).toBeVisible();
    await expect(page.locator('[data-sf-bag-button], [data-bl-bag-button]').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'confirmation-no-recommendations-viewport-1440.png'),
      fullPage: false,
    });
  });

  test('deposit payment error confirmation stays readable without empty icon column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/book/blackline-barbers-demo/success', { waitUntil: 'domcontentloaded' });
    await acceptCookiesIfPresent(page);

    const error = page.locator('.booking-confirmation--error');
    await expect(error).toBeVisible();
    await expect(error.getByRole('heading', { name: 'Could not confirm' })).toBeVisible();
    await expect(error.locator('.booking-confirmation__icon')).toHaveCount(0);
    await expect(error.locator('.booking-confirmation__header > *')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Back to booking' })).toBeVisible();

    const metrics = await error.evaluate((node) => {
      const header = node.querySelector('.booking-confirmation__header') as HTMLElement | null;
      const body = node.querySelector('.booking-confirmation__body') as HTMLElement | null;
      const cta = node.querySelector('.booking-confirmation__cta a') as HTMLElement | null;
      const hr = header?.getBoundingClientRect();
      const br = body?.getBoundingClientRect();
      const cr = cta?.getBoundingClientRect();
      return {
        headerColumns: header ? getComputedStyle(header).gridTemplateColumns : null,
        bodyClipped: br ? br.right > window.innerWidth + 2 || br.left < -2 : true,
        ctaVisible: Boolean(cr && cr.width > 0 && cr.height > 0),
      };
    });
    expect(metrics.headerColumns || '').not.toMatch(/^auto\s/);
    expect(metrics.bodyClipped).toBe(false);
    expect(metrics.ctaVisible).toBe(true);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'deposit-error-viewport-1440x900.png'),
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(error).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to booking' })).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'deposit-error-viewport-390x844.png'),
      fullPage: false,
    });
  });
});
