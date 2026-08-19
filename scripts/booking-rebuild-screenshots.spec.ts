import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1440, height: 900, name: '1440' },
  { width: 1024, height: 768, name: '1024' },
  { width: 390, height: 844, name: '390' },
  { width: 360, height: 800, name: '360' },
] as const;

const LIGHT_VARS: Record<string, string> = {
  '--booking-bg': '#f6f3ee',
  '--booking-bg-elevated': '#fffdf8',
  '--booking-surface': '#ffffff',
  '--booking-text': '#161412',
  '--booking-accent': '#d72638',
  '--booking-accent-contrast': '#ffffff',
};

async function shot(page: Page, name: string) {
  mkdirSync('tmp/booking-rebuild', { recursive: true });
  await page.screenshot({ path: `tmp/booking-rebuild/${name}.png`, fullPage: true });
}

async function applyLightTheme(page: Page) {
  await page.locator('.booking-experience').evaluate((root, vars) => {
    root.setAttribute('data-booking-theme', 'light');
    root.classList.remove('booking-experience--dark');
    root.classList.add('booking-experience--light');
    for (const [key, value] of Object.entries(vars)) {
      (root as HTMLElement).style.setProperty(key, value);
    }
  }, LIGHT_VARS);
}

test.describe('Booking rebuild screenshots', () => {
  for (const viewport of VIEWPORTS) {
    test(`BLACKLINE /demo/book ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/demo/book', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.booking-experience')).toBeVisible();
      await shot(page, `blackline-service-${viewport.name}`);
      await page.locator('button.booking-choice-card--service').first().click();
      await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
      await shot(page, `blackline-barber-${viewport.name}`);
    });

    test(`KERSIVO /book ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/book', { waitUntil: 'domcontentloaded' });
      if (await page.getByText('Online booking is temporarily unavailable').count()) {
        test.skip(true, 'Sandbox catalogue is unavailable in this environment');
      }
      await expect(page.locator('.booking-experience')).toBeVisible();
      await shot(page, `kersivo-service-${viewport.name}`);
    });

    test(`light theme overlay ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/demo/book', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.booking-experience')).toBeVisible();
      await applyLightTheme(page);
      await shot(page, `light-service-${viewport.name}`);
    });
  }
});
