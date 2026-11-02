import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.platform === 'win32' ? 'C:/tmp/kersivo-shots/hub-p1' : '/tmp/kersivo-shots/hub-p1';
mkdirSync(shotDir, { recursive: true });

const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const hubCss = readFileSync(join(root, 'src/styles/components/admin-hub.css'), 'utf8').replace(
  /@import '[^']+';\s*/g,
  '',
);
const fabCss = readFileSync(join(root, 'src/styles/components/admin-mobile-fab.css'), 'utf8');

const CHROME = `
.admin-shell {
  min-height: 100dvh;
  --admin-z-modal-backdrop: 250;
  --admin-z-app-chrome: 260;
  --admin-z-modal-sheet: 270;
  --admin-z-mobile-menu-overlay: 265;
  background: #0b0d10;
  color: #f4f4f5;
  font-family: Inter, system-ui, sans-serif;
}
.admin-mobile-top-chrome {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: var(--admin-z-app-chrome, 260);
  background: #121214;
}
.admin-barbershop-paused-banner {
  padding: 8px 16px;
  background: #3a2a12;
  color: #ffd38a;
  font-size: 12px;
}
.admin-mobile-header {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.admin-mobile-header--with-next { min-height: 96px; align-items: flex-start; }
.admin-mobile-header-bar { display: flex; width: 100%; align-items: center; min-height: 56px; }
.admin-mobile-header-extension { padding: 0 0 10px; font-size: 13px; color: #a1a1aa; }
.admin-main-content { isolation: isolate; padding-top: 72px; }
.admin-mobile-fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 70;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  border: 0;
  background: #e11d2e;
  color: #fff;
}
`;

const OLD_STACK = `
.admin-hub-app-root { z-index: 60 !important; }
.admin-hub-app--sheet { top: 56px !important; max-height: none !important; }
`;

function pageHtml(opts: {
  title: string;
  mode: 'sheet' | 'window';
  portal: boolean;
  before?: boolean;
  paused?: boolean;
  withNext?: boolean;
}) {
  const sheetClass =
    opts.mode === 'sheet' ? 'admin-hub-app admin-hub-app--sheet' : 'admin-hub-app admin-hub-app--window';
  const sheet = `
    <div class="admin-hub-app-root">
      <div class="admin-hub-app__scrim" aria-hidden="true"></div>
      <div class="${sheetClass}" role="dialog" aria-modal="true" aria-labelledby="hub-sheet-title" data-testid="admin-hub-app">
        ${opts.mode === 'sheet' ? '<span class="admin-hub-app__grab" aria-hidden="true"></span>' : ''}
        <header class="admin-hub-app__bar">
          <span class="admin-hub-app__icon" aria-hidden="true"></span>
          <div>
            <h2 class="admin-hub-app__title" id="hub-sheet-title">${opts.title}</h2>
          </div>
          <button type="button" class="admin-hub-app__close" aria-label="Close">×</button>
        </header>
        <div class="admin-hub-app__body"><p>${opts.title} body</p></div>
      </div>
    </div>`;
  const header = `
    <div class="admin-mobile-top-chrome">
      ${opts.paused ? '<div class="admin-barbershop-paused-banner">Bookings are paused</div>' : ''}
      <header class="admin-mobile-header${opts.withNext ? ' admin-mobile-header--with-next' : ''}">
        <div class="admin-mobile-header-bar">
          <strong>Overview</strong>
          <span>Menu</span>
        </div>
        ${opts.withNext ? '<div class="admin-mobile-header-extension">Next: 14:00 Fade</div>' : ''}
      </header>
    </div>`;
  return `<!doctype html>
<html lang="en-GB" class="admin-app-scroll">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    ${tokens}
    body { margin: 0; background: #0b0d10; }
    ${CHROME}
    ${hubCss}
    ${fabCss}
    ${opts.before ? OLD_STACK : ''}
  </style>
</head>
<body>
  <div class="admin-shell">
    ${header}
    <div class="admin-main-content">${opts.portal ? '' : sheet}</div>
  </div>
  <button type="button" class="admin-mobile-fab" data-testid="admin-mobile-fab" aria-label="Add">+</button>
  ${opts.portal ? sheet : ''}
</body>
</html>`;
}

async function open(page: Page, html: string) {
  await page.setContent(html, { waitUntil: 'load' });
}

async function barVisibleAboveHeader(page: Page) {
  const grab = page.locator('.admin-hub-app__grab');
  const title = page.locator('.admin-hub-app__title');
  const close = page.locator('.admin-hub-app__close');
  await expect(title).toBeVisible();
  await expect(close).toBeVisible();
  const titleBox = await title.boundingBox();
  const closeBox = await close.boundingBox();
  expect(titleBox, 'title box').toBeTruthy();
  expect(closeBox, 'close box').toBeTruthy();
  expect(titleBox!.y).toBeGreaterThanOrEqual(0);
  expect(closeBox!.y).toBeGreaterThanOrEqual(0);
  if (await grab.count()) {
    await expect(grab).toBeVisible();
    const grabBox = await grab.boundingBox();
    expect(grabBox!.y).toBeGreaterThanOrEqual(0);
    const onTop = await page.evaluate(() => {
      const node = document.querySelector('.admin-hub-app__grab');
      if (!node) return false;
      const r = node.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return Boolean(hit?.closest('.admin-hub-app'));
    });
    expect(onTop, 'grab handle is not covered by the mobile header').toBe(true);
  }
  const closeOnTop = await page.evaluate(() => {
    const node = document.querySelector('.admin-hub-app__close');
    if (!node) return false;
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return Boolean(hit?.closest('.admin-hub-app__close, .admin-hub-app'));
  });
  expect(closeOnTop, 'close control is not covered by the mobile header').toBe(true);
}

test.describe('hub-p1 sheets above chrome', () => {
  test('375 Add / Colours / Activity — before (trapped) and after (portaled)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    for (const title of ['Add', 'Brand colours', 'Activity'] as const) {
      const slug = title === 'Brand colours' ? 'colours' : title.toLowerCase();
      await open(
        page,
        pageHtml({ title, mode: 'sheet', portal: false, before: true }),
      );
      await page.screenshot({ path: join(shotDir, `${slug}-375-before.png`) });

      await open(page, pageHtml({ title, mode: 'sheet', portal: true }));
      await barVisibleAboveHeader(page);
      await expect(page.getByTestId('admin-mobile-fab')).toBeHidden();
      await page.screenshot({ path: join(shotDir, `${slug}-375-after.png`) });
    }
  });

  test('375 paused banner and with-next header still leave the bar visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await open(page, pageHtml({ title: 'Add', mode: 'sheet', portal: true, paused: true }));
    await barVisibleAboveHeader(page);
    await page.screenshot({ path: join(shotDir, 'add-paused-375-after.png') });

    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, pageHtml({ title: 'Add', mode: 'sheet', portal: true, withNext: true }));
    await barVisibleAboveHeader(page);
    await page.screenshot({ path: join(shotDir, 'add-with-next-390-after.png') });
  });

  test('1440 window mode is unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const title of ['Add', 'Brand colours', 'Activity'] as const) {
      const slug = title === 'Brand colours' ? 'colours' : title.toLowerCase();
      await open(page, pageHtml({ title, mode: 'window', portal: false, before: true }));
      await page.screenshot({ path: join(shotDir, `${slug}-1440-before.png`) });
      await open(page, pageHtml({ title, mode: 'window', portal: true }));
      await expect(page.locator('.admin-hub-app--window')).toBeVisible();
      await expect(page.locator('.admin-hub-app--sheet')).toHaveCount(0);
      await page.screenshot({ path: join(shotDir, `${slug}-1440-after.png`) });
    }
  });
});
