import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

for (const url of ['http://localhost:4321/', 'http://localhost:4321/barbershop-booking-system']) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => {
    document.querySelector('#live-demo, .feature261')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(2500);

  const stats = await page.evaluate(() => {
    const cardStyles = Array.from(document.querySelectorAll('[data-feature261-card]')).map((c) => ({
      visible: c.getAttribute('data-feature261-visible'),
      opacity: getComputedStyle(c).opacity,
    }));
    const isw = document.querySelector('.isw');
    const iswBox = isw?.getBoundingClientRect();
    return {
      isw: Boolean(isw),
      iswSize: iswBox ? { w: iswBox.width, h: iswBox.height } : null,
      lbw: Boolean(document.querySelector('.lbw')),
      bookingImg: Boolean(document.querySelector('img[src*="bookingi"]')),
      adminVtlCount: document.querySelectorAll('.admin-vtl').length,
      cardStyles,
    };
  });

  console.log('\nURL', url);
  console.log(JSON.stringify(stats, null, 2));
}

console.log('\nErrors:', errors.slice(0, 15));
await browser.close();
