import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGIN = 'http://127.0.0.1:4397';
const phase = process.argv[2] || 'before';
const BASE = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/hub-p6-bento-swap' : '/tmp/kersivo-shots/hub-p6-bento-swap';
const OUT = join(BASE, phase);
mkdirSync(OUT, { recursive: true });

const seed = JSON.parse(readFileSync('.preview-hub-seed.json', 'utf8'));
const findings = [];

async function layout(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('.admin-hub-bento');
    if (!grid) return null;
    const tiles = [...grid.children].map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tile: el.getAttribute('data-tile'),
        area: cs.gridArea,
        x: Math.round(r.x),
        y: Math.round(r.y + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
    const gcs = getComputedStyle(grid);
    const empty = document.querySelector('.admin-hub-content-empty');
    return {
      noChanges: grid.classList.contains('admin-hub-bento--no-changes'),
      areas: gcs.gridTemplateAreas,
      tiles,
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
      contentEmpty: empty
        ? {
            text: empty.textContent.trim(),
            controls: empty.querySelectorAll('a,button').length,
            marginTop: getComputedStyle(empty).marginTop,
          }
        : null,
      contentHeadAdd: (() => {
        const el = document.querySelector('[data-tile="content"] .admin-hub-tile__head a, [data-tile="content"] .admin-hub-tile__head button');
        return el ? { tag: el.tagName, label: el.getAttribute('aria-label'), testid: el.getAttribute('data-testid') } : null;
      })(),
    };
  });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const stage of ['requested', 'ready']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`${ORIGIN}/preview/${seed[stage].token}`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${ORIGIN}/admin`, { waitUntil: 'networkidle' });
    const reject = page.getByRole('button', { name: 'Reject optional' });
    if (await reject.isVisible().catch(() => false)) await reject.click();
    await page.locator('.admin-hub-bento').waitFor();
    for (const width of [375, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(400);
      const info = await layout(page);
      findings.push({ stage, width, ...info });
      await page.locator('.admin-hub-bento').screenshot({ path: join(OUT, `${stage}-${width}.png`) });
    }
    if (phase === 'after') {
      await page.setViewportSize({ width: 1440, height: 900 });
      const add = page.locator('[data-tile="content"] .admin-hub-tile__head').locator('a,button').first();
      await add.focus();
      const focused = await page.evaluate(() => ({
        label: document.activeElement?.getAttribute('aria-label'),
        outline: getComputedStyle(document.activeElement).outlineStyle,
      }));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const menuOpen = await page.locator('[role="menu"]').first().isVisible().catch(() => false);
      await page.locator('[data-tile="content"]').screenshot({ path: join(OUT, `${stage}-content-menu-open-1440.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
      const menuOpenSpace = await page.locator('[role="menu"]').first().isVisible().catch(() => false);
      await page.keyboard.press('Escape');
      findings.push({ stage, keyboard: { focused, menuOpenEnter: menuOpen, menuOpenSpace } });
    }
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
  console.log(JSON.stringify(findings, null, 1));
}
