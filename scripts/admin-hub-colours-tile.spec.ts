import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = join(tmpdir(), 'kersivo-shots', 'admin-hub-colours-tile');
mkdirSync(shotDir, { recursive: true });

const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const hubCss = readFileSync(join(root, 'src/styles/components/admin-hub.css'), 'utf8').replace(
  /@import '[^']+';\s*/g,
  '',
);

const PAGE = `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    ${tokens}
    body { margin: 0; background: #0b0d10; color: var(--fg); font-family: Inter, system-ui, sans-serif; }
    ${hubCss}
  </style>
</head>
<body>
  <main class="admin-hub-content" style="padding: 24px;">
    <a class="admin-hub-tile admin-hub-bento__colours" data-tile="colours" href="#colours" id="colours-tile">
      <div class="admin-hub-tile__head">
        <span class="admin-hub-tile__title">Brand colours</span>
        <span class="admin-hub-tile__open" aria-label="Open"></span>
      </div>
      <div class="admin-hub-colours-body">
        <div class="admin-hub-logo-mini">
          <span class="admin-hub-logo-mini__mark"><span>NB</span></span>
        </div>
        <div class="admin-hub-swatches">
          <div class="admin-hub-sw"><span class="admin-hub-sw__chip"></span><small>#1F6F6B</small></div>
        </div>
        <div class="admin-hub-tile__foot">Not sent yet</div>
      </div>
    </a>
    <article class="admin-hub-tile admin-hub-bento__preview" data-tile="preview" id="preview-tile">
      <a class="admin-hub-tile__hit" href="#preview" id="preview-hit"><span class="admin-hub-sr-only">Your preview</span></a>
      <div class="admin-hub-tile__head">
        <span class="admin-hub-tile__title">Your preview</span>
      </div>
      <div class="admin-hub-preview-actions">
        <a class="btn btn--primary btn--sm" href="#website">Open website</a>
      </div>
    </article>
    <div class="admin-hub-app__body">
      <div class="admin-hub-colours" data-testid="admin-hub-colours">
        <div class="admin-hub-colours__logo" data-testid="admin-hub-colours-logo">
          <div class="admin-hub-colours__logo-frame">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect width='120' height='80' fill='%231f6f6b'/%3E%3C/svg%3E" alt="" />
          </div>
        </div>
        <div class="admin-hub-colours__logo admin-hub-colours__logo--in-panel" data-testid="admin-hub-colours-logo-empty">
          <div class="admin-hub-colours__logo-empty">
            <p>No logo uploaded yet</p>
            <a class="btn btn--outline btn--sm" href="#upload">Upload logo</a>
          </div>
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;

async function openFixture(page: Page) {
  await page.setContent(PAGE, { waitUntil: 'load' });
}

function targetHref(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit?.closest('a')?.getAttribute('href') || null;
  });
}

test.describe('Brand colours tile + mobile logo', () => {
  test('the whole colours tile is one link, including title and swatches', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFixture(page);
    const tile = page.locator('[data-tile="colours"]');
    await expect(tile).toHaveAttribute('href', '#colours');
    await expect(tile.locator('button')).toHaveCount(0);
    expect(await targetHref(page, '[data-tile="colours"] .admin-hub-tile__title')).toBe('#colours');
    expect(await targetHref(page, '[data-tile="colours"] .admin-hub-logo-mini')).toBe('#colours');
    expect(await targetHref(page, '[data-tile="colours"] .admin-hub-swatches')).toBe('#colours');
    expect(await targetHref(page, '[data-tile="colours"] .admin-hub-tile__foot')).toBe('#colours');
    await tile.focus();
    await expect(tile).toBeFocused();
    await page.screenshot({ path: join(shotDir, 'tile-1440.png'), fullPage: true });
  });

  test('preview overlay still opens from the header, not only nested buttons', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFixture(page);
    expect(await targetHref(page, '[data-tile="preview"] .admin-hub-tile__title')).toBe('#preview');
    expect(await targetHref(page, '[data-tile="preview"] .btn')).toBe('#website');
  });

  test('logo preview is visible between 360 and 430 px', async ({ page }) => {
    for (const width of [360, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await openFixture(page);
      const logo = page.getByTestId('admin-hub-colours-logo');
      await expect(logo, `logo @${width}`).toBeVisible();
      const img = logo.locator('img');
      await expect(img).toBeVisible();
      const box = await img.boundingBox();
      expect(box?.height, `logo height @${width}`).toBeGreaterThan(0);
      expect(box?.height, `logo max-height @${width}`).toBeLessThanOrEqual(96);
      await expect(page.getByTestId('admin-hub-colours-logo-empty')).toBeHidden();
      await page.screenshot({ path: join(shotDir, `app-${width}.png`), fullPage: true });
    }
  });
});
