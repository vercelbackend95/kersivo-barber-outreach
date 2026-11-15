// Usage: node scripts/_pl-interact.mjs <baseUrl>  — fills the price list tool and screenshots it.
import { chromium } from 'playwright';
const [base] = process.argv.slice(2);
const out = 'C:/tmp/kersivo-shots/buying-content';
const b = await chromium.launch();
for (const width of [375, 1440]) {
  const c = await b.newContext({ viewport: { width, height: 900 } });
  await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const p = await c.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base + '/barbershop-price-list-template', { waitUntil: 'load', timeout: 180000 });
  await p.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  try { const r = p.getByRole('button', { name: 'Reject optional' }); await r.waitFor({ timeout: 3000 }); await r.click(); } catch {}
  await p.fill('#pl-shop', 'Northside Barbers');
  const prices = p.locator('[data-pl-price]');
  const values = ['18', '20', '22', '10', '26', '25'];
  for (let i = 0; i < values.length; i++) await prices.nth(i).fill(values[i]);
  await p.locator('[data-pl-minutes]').nth(1).selectOption('45');
  await p.locator('[data-pl-from]').nth(2).check();
  await p.check('input[name="duration"]');
  await p.fill('#pl-footer', 'Book online at northside.example');
  await p.click('#pl-add');
  await p.locator('[data-pl-name]').last().fill('Eyebrow tidy');
  await p.locator('[data-pl-remove]').nth(0).click();
  const missing = await p.textContent('#pl-missing');
  await p.click('#pl-copy');
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => 'n/a');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await p.locator('#price-list-tool').screenshot({ path: `${out}/pl-tool-${width}.png` });
  await p.screenshot({ path: `${out}/after_barbershop-price-list-template-${width}.png`, fullPage: true });
  await p.emulateMedia({ media: 'print' });
  await p.screenshot({ path: `${out}/pl-print-${width}.png` });
  console.log(JSON.stringify({ width, missing, clip, overflow, errors }));
  await c.close();
}
await b.close();
