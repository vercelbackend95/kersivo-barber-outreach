import { chromium } from 'playwright';

const BASE_URL = process.env.WIDGET_CHECK_BASE_URL ?? 'http://localhost:4321';
const PATHS = ['/', '/barbershop-booking-system'];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;

  const text = message.text();
  // Known benign hydration noise from live time labels and carousel scroll state.
  if (
    text.includes('Hydration failed')
    || text.includes('A tree hydrated but some attributes')
  ) {
    return;
  }

  errors.push(text);
});

let failed = false;

for (const path of PATHS) {
  const url = `${BASE_URL}${path}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.evaluate(() => {
    document.querySelector('#live-demo, .feature261')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(2500);

  await page.locator('.admin-vtl-slot--interactive').first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(400);

  const stats = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-feature261-card]'));
    const cardStyles = cards.map((card) => ({
      visible: card.getAttribute('data-feature261-visible'),
      opacity: getComputedStyle(card).opacity,
    }));
    const isw = document.querySelector('.isw');
    const iswBox = isw?.getBoundingClientRect();
    const lbw = document.querySelector('.lbw');
    const lbwBox = lbw?.getBoundingClientRect();
    const carouselItems = document.querySelectorAll('.feature261__media--carousel .shop6__item').length;
    const barberAvatarImgs = Array.from(
      document.querySelectorAll('.admin-vtl-avatar-img[src*="landing-demo"], .admin-vtl-expansion-avatar-img[src*="landing-demo"]'),
    );
    const barberAvatarHeights = barberAvatarImgs.map((img) => img.getBoundingClientRect().height);
    const clientAvatarImgs = Array.from(
      document.querySelectorAll(
        '.admin-vtl-expansion-avatar--client .admin-vtl-expansion-avatar-img, .admin-vtl-client-panel-avatar-img[src*="landing-demo"]',
      ),
    );
    const clientAvatarHeights = clientAvatarImgs.map((img) => img.getBoundingClientRect().height);
    const bookingCategoryHeadings = document.querySelectorAll('.booking-service-category__heading').length;

    return {
      cardCount: cards.length,
      cardStyles,
      isw: Boolean(isw),
      iswHeight: iswBox?.height ?? 0,
      lbw: Boolean(lbw),
      lbwHeight: lbwBox?.height ?? 0,
      bookingScreenshot: Boolean(document.querySelector('img[src*="bookingi"]')),
      carouselItems,
      adminVtlCount: document.querySelectorAll('.admin-vtl').length,
      barberAvatarCount: barberAvatarImgs.length,
      barberAvatarMaxHeight: barberAvatarHeights.length > 0 ? Math.max(...barberAvatarHeights) : 0,
      clientAvatarCount: clientAvatarImgs.length,
      clientAvatarMaxHeight: clientAvatarHeights.length > 0 ? Math.max(...clientAvatarHeights) : 0,
      bookingCategoryHeadings,
    };
  });

  const issues = [];

  if (stats.cardCount === 0) {
    issues.push('no feature261 cards found');
  }

  if (stats.cardStyles.some((card) => Number(card.opacity) < 0.99)) {
    issues.push(`cards hidden (opacity): ${JSON.stringify(stats.cardStyles)}`);
  }

  if (!stats.isw || stats.iswHeight <= 0) {
    issues.push('timeline widget (.isw) missing or zero height');
  }

  if (!stats.lbw || stats.lbwHeight <= 0) {
    issues.push('booking widget (.lbw) missing or zero height');
  }

  if (stats.bookingScreenshot) {
    issues.push('booking row fell back to static screenshot');
  }

  if (stats.carouselItems < 1) {
    issues.push('product carousel has no items');
  }

  if (stats.barberAvatarCount < 1 || stats.barberAvatarMaxHeight <= 0) {
    issues.push('timeline barber avatar images missing');
  }

  if (stats.clientAvatarCount < 1 || stats.clientAvatarMaxHeight <= 0) {
    issues.push('timeline client avatar images missing');
  }

  if (stats.bookingCategoryHeadings < 5) {
    issues.push(`booking widget shows only ${stats.bookingCategoryHeadings} service categories (expected >= 5)`);
  }

  console.log(`\n${url}`);
  console.log(JSON.stringify(stats, null, 2));

  if (issues.length > 0) {
    failed = true;
    console.error('Issues:');
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
  } else {
    console.log('OK');
  }
}

if (errors.length > 0) {
  failed = true;
  console.error('\nConsole/page errors:');
  for (const error of errors.slice(0, 15)) {
    console.error(`  - ${error}`);
  }
}

await browser.close();

if (failed) {
  process.exitCode = 1;
}
