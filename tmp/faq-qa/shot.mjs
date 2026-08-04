import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tmp/faq-qa', { recursive: true });
const browser = await chromium.launch();

async function shot(w, h, file, openFirst = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /Accept all/i });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.locator('#faq').scrollIntoViewIfNeeded();
  if (openFirst) {
    await page.locator('#faq details.faq4__item').first().locator('summary').click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
  await page.locator('#faq').screenshot({ path: file });
  const count = await page.locator('#faq details.faq4__item').count();
  const demo = await page.locator('#faq').getByText('View Live Demo').count();
  const pricing = await page.locator('#faq a[href="#pricing"]').count();
  const roles = await page.locator('#faq [role="list"], #faq [role="listitem"]').count();
  console.log(`${w}x${h} items=${count} demo=${demo} pricingCta=${pricing} roles=${roles}`);
  await page.close();
}

await shot(1440, 900, 'tmp/faq-qa/faq-1440.png', true);
await shot(390, 844, 'tmp/faq-qa/faq-390.png', true);
await shot(1024, 768, 'tmp/faq-qa/faq-1024.png');
await shot(768, 1024, 'tmp/faq-qa/faq-768.png');
await browser.close();
console.log('done');
