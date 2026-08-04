import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tmp/final-cta-qa', { recursive: true });
const browser = await chromium.launch();

async function shot(w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /Accept all/i });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  const section = page.locator('.landing-final-cta').first();
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await section.screenshot({ path: file });
  const demo = await section.getByText('View Live Demo').count();
  const pricing = await section.locator('a[href="#pricing"]').count();
  const mailto = await section.locator('a[href^="mailto:"]').count();
  const cta = section.locator('a[data-track="saas_subscribe_click"]');
  const href = (await cta.count()) ? await cta.first().getAttribute('href') : null;
  const trackCount = await section.locator('[data-track]').count();
  console.log(`${w}x${h} demo=${demo} pricing=${pricing} mailto=${mailto} href=${href} tracks=${trackCount}`);
  await page.close();
}

await shot(1440, 900, 'tmp/final-cta-qa/cta-1440.png');
await shot(390, 844, 'tmp/final-cta-qa/cta-390.png');
await shot(1024, 768, 'tmp/final-cta-qa/cta-1024.png');
await shot(768, 1024, 'tmp/final-cta-qa/cta-768.png');
await browser.close();
console.log('done');
