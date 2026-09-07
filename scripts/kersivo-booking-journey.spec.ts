import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCREENSHOT_DIR = 'C:\\temp\\booking-confirmation-commerce-v2-1-review';

test.describe('KERSIVO sandbox booking', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('completes the public /book demo on the shared engine', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/book', { waitUntil: 'domcontentloaded' });
    const accept = page.getByRole('button', { name: 'Accept all' });
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
    }

    if (await page.getByText('Online booking is temporarily unavailable').count()) {
      test.skip(true, 'Sandbox catalogue is unavailable in this environment');
    }

    await expect(page.getByRole('heading', { name: 'Try the booking flow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Choose a service/i })).toBeVisible();

    const bookingApiCalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /\/api\/bookings\b/.test(url) ||
        /stripe|resend|sendgrid|openai/i.test(url)
      ) {
        bookingApiCalls.push(url);
      }
    });

    const service = page.locator('button.booking-choice-card--service').first();
    await expect(service).toBeVisible();
    await service.click();
    await expect(page.getByRole('heading', { name: /Choose a service/i })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
    await page.getByRole('radio', { name: /Any barber/i }).click();
    await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    const slot = page.locator('button.booking-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel(/^Name$/i).fill('Alex Demo');
    await page.getByLabel(/^Email$/i).fill('alex@example.com');
    await page.getByRole('button', { name: 'Complete demo booking' }).click();

    await expect(page.getByText('Demo complete')).toBeVisible();
    await expect(page.getByText("You're all set")).toBeVisible();
    expect(bookingApiCalls).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const experience = page.locator('[data-booking-confirmation-experience]');
    await expect(experience).toBeVisible();
    await expect(page.locator('.booking-confirmation__pass, .booking-confirmation__summary').first()).toBeVisible();

    const orderOk = await page.evaluate(() => {
      const confirm = document.querySelector('.booking-confirmation-experience__confirm');
      const actions = document.querySelector('.booking-confirmation-experience__actions');
      const rail = document.querySelector('.booking-recommendations');
      if (!confirm) return false;
      if (actions && rail) {
        return (actions.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }
      if (confirm && rail) {
        return (confirm.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }
      return true;
    });
    expect(orderOk).toBe(true);

    // Theme safety: no BLACKLINE demo chrome on KERSIVO sandbox confirmation
    await expect(page.locator('.bl-booking')).toHaveCount(0);
    await expect(page.locator('[data-theme="blackline"]')).toHaveCount(0);
    const leakedCobalt = await page.evaluate(() => {
      const stage = document.querySelector('[data-booking-confirmation-experience]');
      if (!stage) return true;
      const sample = stage.querySelector('.booking-confirmation__pass, .booking-confirmation-experience__cta--primary');
      if (!sample) return false;
      const color = getComputedStyle(sample as Element).getPropertyValue('--bl-cobalt').trim();
      return Boolean(color);
    });
    expect(leakedCobalt).toBe(false);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'kersivo-confirmation-viewport-1440x900.png'),
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await expect(page.getByText("You're all set")).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'kersivo-confirmation-viewport-390x844.png'),
      fullPage: false,
    });
  });
});
