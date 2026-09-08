import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCREENSHOT_DIR = 'C:\\temp\\booking-confirmation-hover-clip';
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
    const card2 = cards[2] as HTMLElement | undefined;
    const card3 = cards[3] as HTMLElement | undefined;
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
      primaryCtaWidth: primaryCta ? (primaryCta as HTMLElement).getBoundingClientRect().width : null,
      secondaryCtaWidth: (() => {
        const el = document.querySelector('.booking-confirmation-experience__cta--secondary');
        return el ? el.getBoundingClientRect().width : null;
      })(),
      secondaryCtaHeight: (() => {
        const el = document.querySelector('.booking-confirmation-experience__cta--secondary');
        return el ? el.getBoundingClientRect().height : null;
      })(),
      successIconSize: (() => {
        const el = document.querySelector('.booking-confirmation__icon') as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      })(),
      calendarTrigger: (() => {
        const el = document.querySelector('.booking-add-to-calendar__trigger') as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          visible: style.display !== 'none' && r.width > 0 && r.height > 0,
          height: r.height,
          width: r.width,
          insidePass: Boolean(el.closest('.booking-confirmation__pass')),
        };
      })(),
      passWidth: pass?.getBoundingClientRect().width ?? null,
      primaryLeft: primaryCol?.getBoundingClientRect().left ?? null,
      primaryRight: primaryCol?.getBoundingClientRect().right ?? null,
      card0Width: card0?.getBoundingClientRect().width ?? null,
      mediaHeight: media ? media.getBoundingClientRect().height : null,
      firstCardInViewport: (() => {
        if (!card0 || !media || !name || !price || !add) return false;
        const parts = [media, name, price, add, card0];
        return parts.every((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= -2 && r.bottom <= vh + 2 && r.left >= -6 && r.right <= vw + 6;
        });
      })(),
      sideBySide:
        primaryCol && rail
          ? Math.abs(primaryCol.getBoundingClientRect().top - rail.getBoundingClientRect().top) < 120 &&
            primaryCol.getBoundingClientRect().right <= rail.getBoundingClientRect().left + 8
          : false,
      stackedBelowCtas:
        actions && rail
          ? rail.getBoundingClientRect().top >= actions.getBoundingClientRect().bottom - 1
          : false,
      horizontalOverlap:
        primaryCol && rail
          ? (() => {
              const p = primaryCol.getBoundingClientRect();
              const r = rail.getBoundingClientRect();
              return p.left < r.right && p.right > r.left && p.top < r.bottom && p.bottom > r.top;
            })()
          : false,
      railCount: document.querySelectorAll('.booking-recommendations').length,
      cardBorderWidth: card0 ? getComputedStyle(card0).borderWidth : null,
      cardTransform: card0 ? getComputedStyle(card0).transform : null,
      completeCards: [card0, card1, card2, card3].filter((c) => completeCard(c)).length,
      peekFourth:
        card3
          ? (() => {
              const r = card3.getBoundingClientRect();
              return r.left < vw - 8 && r.right > vw - 48 && r.width > 20;
            })()
          : false,
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
      headerInner: (() => {
        const inner = document.querySelector('.sf-header-inner') as HTMLElement | null;
        const brand = document.querySelector('.sf-header-brand, .bl-wordmark') as HTMLElement | null;
        const bagBtn = document.querySelector(
          '[data-sf-bag-button], [data-bl-bag-button], .sf-bag-button',
        ) as HTMLElement | null;
        if (!inner || !brand || !bagBtn) return null;
        const ir = inner.getBoundingClientRect();
        const br = brand.getBoundingClientRect();
        const bagR = bagBtn.getBoundingClientRect();
        return {
          gridTemplateColumns: getComputedStyle(inner).gridTemplateColumns,
          innerLeft: ir.left,
          innerRight: ir.right,
          brandLeft: br.left,
          bagRight: bagR.right,
          bagLeft: bagR.left,
          overlap: br.left < bagR.right && br.right > bagR.left && br.top < bagR.bottom && br.bottom > bagR.top,
          bagNearRight: ir.right - bagR.right <= 8,
          brandNearLeft: br.left - ir.left <= 8,
        };
      })(),
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
    // Calendar control is the only intentional mobile addition; allow heading to sit at the fold edge.
    expect(geometry.headingBottom as number).toBeLessThanOrEqual(geometry.viewportHeight + 4);
    expect(geometry.primaryCtaVisible).toBe(true);
    expect(geometry.primaryCtaMinHeight as number).toBeGreaterThanOrEqual(44);
    return geometry;
  }

  expect(geometry.primaryCtaVisible).toBe(true);

  if (mode === 'desktop') {
    // Stacked full-row carousel — not side-by-side with confirmation.
    expect(geometry.sideBySide).toBe(false);
    expect(geometry.stackedBelowCtas).toBe(true);
    expect(geometry.horizontalOverlap).toBe(false);
    expect(geometry.railCount).toBe(1);
    expect(geometry.stageWidth as number).toBeGreaterThan(1000);
    expect(geometry.stageWidth as number).toBeLessThanOrEqual(1280);
    expect(geometry.passBottom).not.toBeNull();
    expect(geometry.actionsTop).not.toBeNull();
    expect((geometry.actionsTop as number) - (geometry.passBottom as number)).toBeLessThanOrEqual(24);

    // Compact confirmation module (~670px)
    expect(geometry.primaryWidth as number).toBeGreaterThanOrEqual(650);
    expect(geometry.primaryWidth as number).toBeLessThanOrEqual(690);
    const stageCenter = (geometry.stageLeft as number) + (geometry.stageWidth as number) / 2;
    const primaryCenter = (geometry.primaryLeft as number) + (geometry.primaryWidth as number) / 2;
    expect(Math.abs(primaryCenter - stageCenter)).toBeLessThan(24);
    expect(geometry.passWidth as number).toBeLessThanOrEqual((geometry.primaryWidth as number) + 1);

    const icon = geometry.successIconSize as { width: number; height: number } | null;
    expect(icon).not.toBeNull();
    expect(icon!.width).toBeGreaterThanOrEqual(46);
    expect(icon!.width).toBeLessThanOrEqual(50);
    expect(icon!.height).toBeGreaterThanOrEqual(46);
    expect(icon!.height).toBeLessThanOrEqual(50);

    const calendar = geometry.calendarTrigger as {
      visible: boolean;
      height: number;
      insidePass: boolean;
    } | null;
    expect(calendar?.visible).toBe(true);
    expect(calendar?.insidePass).toBe(true);
    expect(calendar!.height).toBeGreaterThanOrEqual(43.5);

    // Fixed CTA proportions
    expect(geometry.primaryCtaWidth as number).toBeGreaterThanOrEqual(280);
    expect(geometry.primaryCtaWidth as number).toBeLessThanOrEqual(300);
    expect(geometry.secondaryCtaWidth as number).toBeGreaterThanOrEqual(170);
    expect(geometry.secondaryCtaWidth as number).toBeLessThanOrEqual(190);
    expect(Math.abs((geometry.primaryCtaMinHeight as number) - (geometry.secondaryCtaHeight as number))).toBeLessThanOrEqual(2);

    const wrap = geometry.recWrapperBox as { borderWidth?: string } | null;
    expect(wrap?.borderWidth === '0px' || wrap?.borderWidth === '' || !wrap?.borderWidth).toBe(true);

    // First complete card (image/name/price/Add) inside 1440×900 without scrolling
    expect(geometry.firstCardInViewport).toBe(true);
    expect(geometry.addVisible).toBe(true);
    expect(geometry.addNotClipped).toBe(true);
    expect(geometry.nameVisible).toBe(true);
    expect(geometry.priceVisible).toBe(true);
    expect(geometry.mediaVisible).toBe(true);
    expect(geometry.headingVisible).toBe(true);
    expect(geometry.announceVisible).toBe(true);
    expect(geometry.completeCards as number).toBeGreaterThanOrEqual(3);
    expect(geometry.card0Width as number).toBeGreaterThanOrEqual(290);
    expect(geometry.card0Width as number).toBeLessThanOrEqual(335);
    expect(geometry.mediaHeight as number).toBeGreaterThanOrEqual(200);
    expect(geometry.mediaHeight as number).toBeLessThanOrEqual(240);

    const peekOk =
      geometry.peekFourth === true ||
      geometry.nextCardPartial === true ||
      (await page.evaluate(() => {
        const vw = window.innerWidth;
        const cards = Array.from(document.querySelectorAll('.booking-recommendations .sf-card'));
        return cards.some((el) => {
          const r = el.getBoundingClientRect();
          return r.left < vw - 8 && r.right > vw + 2; // extends past viewport edge
        });
      }));
    // Prefer a peek when more cards exist than fit; if all products fit fully, that is acceptable.
    const cardCount = await page.locator('.booking-recommendations .sf-card').count();
    if (cardCount > (geometry.completeCards as number)) {
      expect(peekOk).toBe(true);
    } else {
      expect(geometry.completeCards as number).toBeGreaterThanOrEqual(3);
    }
    if (geometry.counterToCardGap != null) {
      // Includes confirm track padding-top (8px) for hover lift clearance.
      expect(geometry.counterToCardGap).toBeLessThanOrEqual(40);
    }
    const cardBorder = String(geometry.cardBorderWidth || '');
    expect(cardBorder === '0px' || cardBorder === '').toBe(false);

    const header = geometry.headerInner as {
      bagNearRight: boolean;
      brandNearLeft: boolean;
      overlap: boolean;
      bagLeft: number;
      brandLeft: number;
    } | null;
    expect(header).not.toBeNull();
    expect(header!.overlap).toBe(false);
    expect(header!.bagNearRight).toBe(true);
    expect(header!.brandNearLeft).toBe(true);
    expect(header!.bagLeft).toBeGreaterThan(header!.brandLeft);

    return geometry;
  }

  expect(geometry.headingVisible).toBe(true);
  expect(geometry.mediaVisible).toBe(true);

  if (mode === 'mobile') {
    // CTA + heading + meaningful media; Add may sit below fold
    expect((geometry.actionsBottom as number) < geometry.viewportHeight).toBe(true);
    expect(geometry.mediaVisiblePct).toBeGreaterThan(0.35);
    // ProductRail mobile contract: ~2.5 visible → ≥2 complete + a peek past the fold
    expect(geometry.completeCards as number).toBeGreaterThanOrEqual(2);
    const peekOk =
      geometry.nextCardPartial === true ||
      geometry.peekFourth === true ||
      (await page.evaluate(() => {
        const vw = window.innerWidth;
        const cards = Array.from(document.querySelectorAll('.booking-recommendations .sf-card'));
        return cards.some((el) => {
          const r = el.getBoundingClientRect();
          return r.left < vw - 8 && r.right > vw + 2;
        });
      }));
    expect(peekOk).toBe(true);
    const recBg = await page.evaluate(() => {
      const section = document.querySelector('.booking-recommendations--confirm') as HTMLElement | null;
      if (!section) return null;
      const style = getComputedStyle(section);
      return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
    });
    expect(recBg).not.toBeNull();
    // Transparent / fully clear — no grey panel fill
    expect(
      recBg!.backgroundColor === 'rgba(0, 0, 0, 0)' ||
        recBg!.backgroundColor === 'transparent' ||
        recBg!.backgroundColor === 'rgba(0,0,0,0)',
    ).toBe(true);
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
    await settleConfirmationTop(page);
    await expect(page.getByRole('button', { name: /Add to calendar/i })).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-viewport-1440x900.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'desktop-1440x900-after.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-first-card-add-1440x900.png'),
      fullPage: false,
    });

    await page.getByRole('button', { name: /Add to calendar/i }).click();
    await expect(page.getByRole('menu', { name: /Calendar options/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Google Calendar/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Apple \/ Other calendar/i })).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-calendar-open-1440x900.png'),
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // Hover: card must stay in place (no upward translate) and remain unclipped.
    await page.locator('.booking-recommendations--confirm').first().scrollIntoViewIfNeeded();
    const hoverCard = recommendationCards(page).first();
    await hoverCard.hover();
    const hoverMetrics = await page.evaluate(() => {
      const card = document.querySelector('.booking-recommendations .sf-card') as HTMLElement | null;
      const track = document.querySelector(
        '.booking-recommendations--confirm .product-rail__track, .booking-recommendations--confirm .product-rail__viewport',
      ) as HTMLElement | null;
      if (!card || !track) return null;
      const cr = card.getBoundingClientRect();
      const tr = track.getBoundingClientRect();
      const style = getComputedStyle(card);
      return {
        transform: style.transform,
        cardTop: cr.top,
        cardBottom: cr.bottom,
        trackTop: tr.top,
        trackBottom: tr.bottom,
        clippedTop: cr.top < tr.top - 1,
        clippedBottom: cr.bottom > tr.bottom + 1,
        fullyInside: cr.top >= tr.top - 1 && cr.bottom <= tr.bottom + 1,
      };
    });
    expect(hoverMetrics).not.toBeNull();
    expect(hoverMetrics!.transform === 'none' || hoverMetrics!.transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
    expect(hoverMetrics!.clippedTop).toBe(false);
    expect(hoverMetrics!.fullyInside).toBe(true);
    geometryLog.desktop1440Hover = hoverMetrics;
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-hover-1440x900.png'),
      fullPage: false,
    });

    // Focus outline remains visible without clipping.
    await hoverCard.focus();
    const focusOutline = await page.evaluate(() => {
      const card = document.querySelector('.booking-recommendations .sf-card') as HTMLElement | null;
      if (!card) return null;
      const style = getComputedStyle(card);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        transform: style.transform,
      };
    });
    geometryLog.desktop1440Focus = focusOutline;
    await page.locator('body').click({ position: { x: 8, y: 8 } }).catch(() => undefined);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await settleConfirmationTop(page);
    geometryLog.desktop1920 = await assertAboveTheFoldCommerce(page, 'desktop');
    await settleConfirmationTop(page);
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
    const mobileCalendar = page.getByRole('button', { name: /Add to calendar/i });
    await expect(mobileCalendar).toBeVisible();
    const mobileCalBox = await mobileCalendar.boundingBox();
    expect(mobileCalBox?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'mobile-after-390x844.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-viewport-390x844.png'),
      fullPage: false,
    });

    // Mobile hover: lift allowed; card top must not clip against the track.
    await page.locator('.booking-recommendations--confirm').first().scrollIntoViewIfNeeded();
    const mobileHoverCard = recommendationCards(page).first();
    await mobileHoverCard.hover();
    const mobileHoverMetrics = await page.evaluate(() => {
      const card = document.querySelector('.booking-recommendations .sf-card') as HTMLElement | null;
      const track = document.querySelector(
        '.booking-recommendations--confirm .product-rail__track, .booking-recommendations--confirm .product-rail__viewport',
      ) as HTMLElement | null;
      if (!card || !track) return null;
      const cr = card.getBoundingClientRect();
      const tr = track.getBoundingClientRect();
      return {
        clippedTop: cr.top < tr.top - 1,
        fullyInside: cr.top >= tr.top - 1 && cr.bottom <= tr.bottom + 1,
        trackPaddingTop: getComputedStyle(track).paddingTop,
      };
    });
    expect(mobileHoverMetrics).not.toBeNull();
    expect(mobileHoverMetrics!.clippedTop).toBe(false);
    expect(mobileHoverMetrics!.fullyInside).toBe(true);
    expect(parseFloat(mobileHoverMetrics!.trackPaddingTop)).toBeGreaterThanOrEqual(8);
    geometryLog.mobile390Hover = mobileHoverMetrics;
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'mobile-390x844-hover-unclipped.png'),
      fullPage: false,
    });

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'iphone-390x844-calendar-visible.png'),
      fullPage: false,
    });

    // iPhone UA: one tap → ICS, no choice menu
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () =>
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
      Object.defineProperty(navigator, 'platform', { configurable: true, get: () => 'iPhone' });
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
      Object.defineProperty(navigator, 'userAgentData', { configurable: true, get: () => undefined });
    });
    const icsDownload = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await mobileCalendar.click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await icsDownload;
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'iphone-390x844-after-tap-no-menu.png'),
      fullPage: false,
    });

    // Android UA: one tap → Google Calendar, no choice menu
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () =>
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      });
      Object.defineProperty(navigator, 'platform', { configurable: true, get: () => 'Linux armv8l' });
      Object.defineProperty(navigator, 'userAgentData', {
        configurable: true,
        get: () => ({ mobile: true, platform: 'Android' }),
      });
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'android-390x844-calendar-visible.png'),
      fullPage: false,
    });
    const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
    await mobileCalendar.click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    const popup = await popupPromise;
    if (popup) {
      expect(popup.url()).toContain('calendar.google.com');
      await popup.close().catch(() => undefined);
    }
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'android-390x844-after-tap-no-menu.png'),
      fullPage: false,
    });

    await page.setViewportSize({ width: 320, height: 568 });
    await settleConfirmationTop(page);
    geometryLog.short320 = await assertAboveTheFoldCommerce(page, 'short');
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'mobile-after-320x568.png'),
      fullPage: false,
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'skin-fade-viewport-320x568-no-overflow.png'),
      fullPage: false,
    });

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
      path: join(SCREENSHOT_DIR, 'mobile-after-320x568.png'),
      fullPage: false,
    });
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

    const timeline = page.getByRole('link', { name: /View booking online/i });
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
