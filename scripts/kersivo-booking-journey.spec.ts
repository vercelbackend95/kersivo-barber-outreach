import { expect, test } from '@playwright/test';

test.describe('KERSIVO sandbox booking', () => {
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

    await expect(page.locator('.booking-experience')).toHaveAttribute('data-booking-theme', 'kersivo');
    await expect(page.getByRole('heading', { name: 'Try the booking flow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Choose a service/i })).toBeVisible();

    const service = page.locator('button.booking-choice-card--service').first();
    await expect(service).toBeVisible();
    await service.click();
    await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
    await page.getByRole('button', { name: /Any barber/i }).click();

    const slot = page.locator('button.booking-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel(/^Name$/i).fill('Alex Demo');
    await page.getByLabel(/^Email$/i).fill('alex@example.com');
    await page.getByRole('button', { name: 'Complete demo booking' }).click();

    await expect(page.getByText('Demo complete')).toBeVisible();
    await expect(page.getByText('That’s the KERSIVO booking experience')).toBeVisible();
  });
});
