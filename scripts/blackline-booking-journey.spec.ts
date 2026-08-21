import { expect, test, type Page } from '@playwright/test';

const TIMELINE_CTA = 'See your booking on the timeline';

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function pickFirstAvailableSlot(page: Page): Promise<string> {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const slots = page.locator('button.booking-slot');
    if ((await slots.count()) > 0) {
      const first = slots.first();
      const label = (await first.innerText()).trim();
      await first.click();
      return label;
    }
    const dateInput = page.locator('#booking-date');
    const current = await dateInput.inputValue();
    const [year, month, day] = current.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    const nextValue = next.toISOString().slice(0, 10);
    await dateInput.fill(nextValue);
    await page.waitForTimeout(250);
  }
  throw new Error('No available BLACKLINE demo slot');
}

test.describe('BLACKLINE booking confirmation to owner timeline', () => {
  test('creates a session booking and focuses it on the owner timeline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/book', { waitUntil: 'domcontentloaded' });
    const bookingSection = page.locator('.bl-booking');
    await expect(bookingSection).toHaveCSS('background-color', 'rgb(11, 12, 14)');
    await expect(page.getByRole('heading', { name: /Choose a service/i })).toHaveCSS(
      'color',
      'rgb(244, 241, 234)',
    );
    await expect(page.getByRole('heading', { name: /Choose a service/i })).toBeVisible();
    await expect(page.locator('.booking-choice-card--service')).toHaveCount(18);

    await page.getByRole('radio', { name: /Skin Fade A seamless fade/i }).click();
    await expect(page.getByRole('heading', { name: /Choose a service/i })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
    await page.getByRole('radio', { name: /^Ellis Ward$/i }).click();
    await expect(page.getByRole('heading', { name: /Choose a barber/i })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    const time = await pickFirstAvailableSlot(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel(/^Name$/i).fill('Alex Demo');
    await page.getByLabel(/^Email$/i).fill('alex@example.com');
    await page.getByRole('button', { name: 'Complete demo booking' }).click();

    await expect(page.getByRole('heading', { name: /That’s the Blackline booking experience/i })).toBeVisible();
    const reference = (await page.locator('.booking-confirmation__summary').getByText(/^BL-\d{4}$/).innerText()).trim();
    const timelineLink = page.getByRole('link', { name: TIMELINE_CTA });
    const href = await timelineLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href?.startsWith('/demo/admin?')).toBe(true);
    expect(href?.startsWith('/admin?')).toBe(false);

    const deepLink = new URL(href!, 'http://127.0.0.1:4321');
    expect(deepLink.searchParams.get('section')).toBe('bookings_dashboard');
    expect(deepLink.searchParams.get('demoJourney')).toBe('booking');
    const bookingId = deepLink.searchParams.get('bookingId');
    const bookingDate = deepLink.searchParams.get('bookingDate');
    expect(bookingId).toBeTruthy();
    expect(bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await timelineLink.click();
    await expect(page).toHaveURL(/\/demo\/admin/);
    await expect(page.getByRole('heading', { name: 'BLACKLINE owner dashboard' })).toBeAttached();

    const card = page.locator(`[data-booking-id="${bookingId}"]`);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText('Skin Fade');
    await expect(card).toContainText('Alex Demo');
    await expect(card).toContainText(time);
    await expect(page.getByText('YOUR DEMO BOOKING')).toBeVisible();

    await expect
      .poll(async () =>
        card.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const viewH = window.innerHeight;
          return rect.top >= -40 && rect.bottom <= viewH + 40;
        }),
      )
      .toBe(true);

    await expect.poll(async () => page.url()).not.toContain('demoJourney=');
    await expect.poll(async () => page.url()).not.toContain('bookingId=');
    expect(new URL(page.url()).pathname).toBe('/demo/admin');

    expect(reference).toMatch(/^BL-\d{4}$/);
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(card).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
