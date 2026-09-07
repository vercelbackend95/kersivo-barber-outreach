import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCREENSHOT_DIR = 'C:\\temp\\booking-confirmation-commerce-v2-1-review';
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
  // Prefer the named barber card hit target; role=radio is a button-based control.
  const ellis = page.getByRole('radio', { name: /Ellis Ward/i });
  await ellis.scrollIntoViewIfNeeded();
  await ellis.click();
  await expect(ellis).toHaveAttribute('aria-checked', 'true', { timeout: 5000 });
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
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
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
    const eyebrow = document.querySelector('.booking-recommendations__eyebrow');
    const rail = document.querySelector('.booking-recommendations');
    const card = document.querySelector('.booking-recommendations .sf-card');
    const media = card?.querySelector('.sf-card-media, .sf-media, .product-rail__sf-media');
    const name = card?.querySelector('.sf-card-name, .product-rail__title');
    const price = card?.querySelector('.sf-card-price, .product-rail__price, .shop-price');
    const add = card?.querySelector('[data-add-to-cart]') as HTMLElement | null;
    const nextCard = document.querySelectorAll('.booking-recommendations .sf-card')[1];
    const stage = document.querySelector('[data-booking-confirmation-experience]');
    const actions = document.querySelector('.booking-confirmation-experience__actions');
    const primaryCta = document.querySelector('.booking-confirmation-experience__cta--primary');
    const confirmCol = document.querySelector('.booking-confirmation-experience__confirm');
    const primaryCol = document.querySelector('.booking-confirmation-experience__primary');
    const recCol = document.querySelector('.booking-confirmation-experience__recommendations');
    const counter = document.querySelector('.product-rail__progress, .product-rail__counter, [data-product-rail-progress]');
    const cards = document.querySelectorAll('.booking-recommendations .sf-card');
    const card0 = cards[0] as HTMLElement | undefined;
    const card1 = cards[1] as HTMLElement | undefined;
    const completeCard = (el: Element | undefined) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.left >= -4 && r.right <= vw + 4 && r.top < vh && r.bottom > 0 && r.width > 40;
    };
    const mediaPct = (() => {
      if (!media) return 0;
      const r = media.getBoundingClientRect();
      const visibleHeight = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      return Math.max(0, visibleHeight) / Math.max(1, r.height);
    })();
    const counterToCardGap = (() => {
      if (!counter || !card0) return null;
      const cr = counter.getBoundingClientRect();
      const cardR = card0.getBoundingClientRect();
      return Math.max(0, cardR.top - cr.bottom);
    })();
    const recWrapperBox = (() => {
      if (!recCol) return null;
      const style = getComputedStyle(recCol as HTMLElement);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return { visible: false, width: 0, height: 0, borderWidth: '0px' };
      }
      const r = (recCol as HTMLElement).getBoundingClientRect();
      return {
        visible: r.width > 1 && r.height > 1,
        width: r.width,
        height: r.height,
        borderWidth: style.borderWidth,
      };
    })();
    const stageRect = stage?.getBoundingClientRect();
    return {
      announceVisible: visibleEnough(announce, 0.55),
      headingVisible: visibleEnough(heading, 0.55),
      eyebrowVisible: visibleEnough(eyebrow, 0.85),
      mediaVisible: visibleEnough(media, 0.35),
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
      headingBottom: heading?.getBoundingClientRect().bottom ?? null,
      eyebrowTop: eyebrow?.getBoundingClientRect().top ?? null,
      eyebrowBottom: eyebrow?.getBoundingClientRect().bottom ?? null,
      railTop: rail?.getBoundingClientRect().top ?? null,
      addBottom: add?.getBoundingClientRect().bottom ?? null,
      viewportWidth: vw,
      viewportHeight: vh,
      stageWidth: stageRect?.width ?? null,
      stageLeft: stageRect?.left ?? null,
      stageRight: stageRect?.right ?? null,
      confirmLeft: confirmCol?.getBoundingClientRect().left ?? null,
      confirmRight: confirmCol?.getBoundingClientRect().right ?? null,
      primaryWidth: primaryCol?.getBoundingClientRect().width ?? null,
      recLeft: recCol?.getBoundingClientRect().left ?? null,
      actionsTop: actions?.getBoundingClientRect().top ?? null,
      actionsBottom: actions?.getBoundingClientRect().bottom ?? null,
      primaryCtaVisible: visibleEnough(primaryCta, 0.7),
      primaryCtaMinHeight: primaryCta ? (primaryCta as HTMLElement).getBoundingClientRect().height : null,
      sideBySide:
        primaryCol && rail
          ? Math.abs(primaryCol.getBoundingClientRect().top - rail.getBoundingClientRect().top) < 120 &&
            primaryCol.getBoundingClientRect().right <= rail.getBoundingClientRect().left + 8
          : false,
      completeCards: [card0, card1].filter((c) => completeCard(c)).length,
      mediaVisiblePct: mediaPct,
      counterToCardGap,
      recWrapperBox,
      hasRecommendationsNode: Boolean(rail),
      actionsBeforeRail:
        actions && rail
          ? (actions.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          : actions
            ? true
            : false,
    };
  });
}

async function assertAboveTheFoldCommerce(page: Page, mode: GeometryMode) {
  const geometry = await readGeometry(page);

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.announceVisible).toBe(true);
  expect(geometry.actionsBeforeRail).toBe(true);

  if (mode === 'short') {
    const safe = 8;
    expect(geometry.eyebrowTop).not.toBeNull();
    expect(geometry.eyebrowBottom).not.toBeNull();
    expect(geometry.headingTop).not.toBeNull();
    expect(geometry.headingBottom).not.toBeNull();
    expect(geometry.eyebrowVisible).toBe(true);
    expect(geometry.eyebrowTop as number).toBeGreaterThanOrEqual(0);
    expect(geometry.eyebrowBottom as number).toBeLessThanOrEqual(geometry.viewportHeight - safe);
    expect(geometry.headingTop as number).toBeGreaterThanOrEqual(0);
    expect(geometry.headingBottom as number).toBeLessThanOrEqual(geometry.viewportHeight - safe);
    expect(geometry.primaryCtaVisible).toBe(true);
    expect(geometry.primaryCtaMinHeight as number).toBeGreaterThanOrEqual(44);
    return geometry;
  }

  expect(geometry.headingVisible).toBe(true);
  expect(geometry.mediaVisible).toBe(true);
  expect(geometry.primaryCtaVisible).toBe(true);

  if (mode === 'desktop') {
    expect(geometry.sideBySide).toBe(true);
    expect(geometry.stageWidth as number).toBeGreaterThan(1000);
    expect(geometry.completeCards).toBeGreaterThanOrEqual(2);
    expect(geometry.addVisible).toBe(true);
    expect(geometry.addNotClipped).toBe(true);
    expect(geometry.nameVisible).toBe(true);
    expect(geometry.priceVisible).toBe(true);
    if (geometry.counterToCardGap != null) {
      expect(geometry.counterToCardGap).toBeLessThanOrEqual(24);
    }
    expect(geometry.passBottom).not.toBeNull();
    expect(geometry.actionsTop).not.toBeNull();
    expect((geometry.actionsTop as number) - (geometry.passBottom as number)).toBeLessThanOrEqual(24);
  }

  if (mode === 'mobile') {
    // CTA + heading + meaningful media; Add may sit below fold
    expect((geometry.actionsBottom as number) < geometry.viewportHeight).toBe(true);
    expect(geometry.mediaVisiblePct).toBeGreaterThan(0.35);
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

    const heading = page.getByRole('heading', { name: 'Keep the finish going' });
    await expect(heading).toBeVisible();
    await expect(page.getByText(/Picked for your Skin Fade\. Add now and collect at your appointment\./)).toBeVisible();

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

    await page.setViewportSize({ width: 1920, height: 1080 });
    await settleConfirmationTop(page);
    geometryLog.desktop1920 = await assertAboveTheFoldCommerce(page, 'desktop');
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-viewport-1920x1080.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-fullpage-1920x1080.png'),
      fullPage: true,
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

    const demoCopy = page.locator('.bl-demo-banner-copy');
    await expect(demoCopy).toBeHidden();
    const ownerView = page.locator('.bl-demo-banner-switch');
    const backToKersivo = page.locator('.bl-demo-banner-back');
    await expect(ownerView).toBeVisible();
    await expect(backToKersivo).toBeVisible();
    const bannerGeometry = await page.evaluate(() => {
      const owner = document.querySelector('.bl-demo-banner-switch') as HTMLElement | null;
      const back = document.querySelector('.bl-demo-banner-back') as HTMLElement | null;
      const copy = document.querySelector('.bl-demo-banner-copy') as HTMLElement | null;
      const or = owner?.getBoundingClientRect();
      const br = back?.getBoundingClientRect();
      const copyStyle = copy ? getComputedStyle(copy) : null;
      const intersects = Boolean(
        or &&
          br &&
          or.left < br.right &&
          or.right > br.left &&
          or.top < br.bottom &&
          or.bottom > br.top,
      );
      const gap =
        or && br
          ? or.right <= br.left
            ? br.left - or.right
            : br.right <= or.left
              ? or.left - br.right
              : -1
          : null;
      return {
        copyDisplay: copyStyle?.display ?? null,
        ownerVisible: Boolean(or && or.width > 0 && or.height > 0),
        backVisible: Boolean(br && br.width > 0 && br.height > 0),
        ownerMinHeight: or?.height ?? null,
        backMinHeight: br?.height ?? null,
        intersects,
        gap,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    expect(bannerGeometry.copyDisplay).toBe('none');
    expect(bannerGeometry.intersects).toBe(false);
    expect(bannerGeometry.gap).not.toBeNull();
    expect(bannerGeometry.gap as number).toBeGreaterThanOrEqual(8);
    expect(bannerGeometry.ownerMinHeight as number).toBeGreaterThanOrEqual(44);
    expect(bannerGeometry.backMinHeight as number).toBeGreaterThanOrEqual(44);
    expect(bannerGeometry.scrollWidth).toBeLessThanOrEqual(bannerGeometry.clientWidth + 1);
    geometryLog.short320Banner = bannerGeometry;

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
      page.getByRole('heading', { name: 'Keep the finish going' }),
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

    await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
    await expect(page.locator('.booking-recommendations')).toHaveCount(0);

    const timeline = page.getByRole('link', { name: /View booking timeline/i });
    await expect(timeline).toBeVisible();
    await expect(timeline).toBeEnabled();
    await expect(page.locator('[data-sf-bag-button], [data-bl-bag-button]').first()).toBeVisible();

    const noRecGeometry = await page.evaluate(() => {
      const stage = document.querySelector('[data-booking-confirmation-experience]') as HTMLElement | null;
      const recWrap = document.querySelector('.booking-confirmation-experience__recommendations') as HTMLElement | null;
      const primary = document.querySelector('.booking-confirmation-experience__primary');
      const actions = document.querySelector('.booking-confirmation-experience__actions');
      const rail = document.querySelector('.booking-recommendations');
      const stageRect = stage?.getBoundingClientRect();
      const wrapStyle = recWrap ? getComputedStyle(recWrap) : null;
      const wrapRect = recWrap?.getBoundingClientRect();
      const wrapVisible =
        Boolean(recWrap) &&
        wrapStyle?.display !== 'none' &&
        wrapStyle?.visibility !== 'hidden' &&
        Boolean(wrapRect && wrapRect.width > 1 && wrapRect.height > 1);
      const children = primary
        ? Array.from(primary.children).map((el) => (el as HTMLElement).className.split(/\s+/)[0] || el.tagName)
        : [];
      return {
        hasRail: Boolean(rail),
        wrapVisible,
        wrapDisplay: wrapStyle?.display ?? null,
        stageWidth: stageRect?.width ?? null,
        stageLeft: stageRect?.left ?? null,
        viewportWidth: window.innerWidth,
        sideBySide: false,
        actionsPresent: Boolean(actions),
        primaryChildren: children,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    expect(noRecGeometry.hasRail).toBe(false);
    expect(noRecGeometry.wrapVisible).toBe(false);
    expect(noRecGeometry.actionsPresent).toBe(true);
    expect(noRecGeometry.stageWidth as number).toBeLessThanOrEqual(640);
    expect(noRecGeometry.stageWidth as number).toBeGreaterThan(280);
    // Centred solo stage — not stuck on the far left of a 1200px empty grid
    const stageCenter = (noRecGeometry.stageLeft as number) + (noRecGeometry.stageWidth as number) / 2;
    expect(Math.abs(stageCenter - noRecGeometry.viewportWidth / 2)).toBeLessThan(48);
    expect(noRecGeometry.scrollWidth).toBeLessThanOrEqual(noRecGeometry.clientWidth + 1);
    writeFileSync(join(SCREENSHOT_DIR, 'geometry-grey-blending.json'), JSON.stringify(noRecGeometry, null, 2));

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'grey-blending-viewport-1440x900.png'),
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await settleConfirmationTop(page);
    await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
    await expect(page.locator('.booking-recommendations')).toHaveCount(0);
    await expect(timeline).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'grey-blending-viewport-390x844.png'),
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
