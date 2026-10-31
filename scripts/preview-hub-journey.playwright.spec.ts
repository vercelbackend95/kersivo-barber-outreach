import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = join(root, 'docs/preview-hub/screens/batch-6');
mkdirSync(shotDir, { recursive: true });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function expectNoSeriousAxe(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) {
    writeFileSync(join(shotDir, `axe-${name}.json`), JSON.stringify(serious, null, 2));
  }
  expect(serious, `${name} axe serious/critical`).toEqual([]);
}

test.describe('Shop Hub flag-ON journey', () => {
  test('full owner journey plus 404 / 410 / asset isolation', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/free-preview', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('First name').fill('Sam');
    await page.getByLabel('Shop name').fill('Sharp Cuts');
    await page.getByLabel('Email').fill('sam@sharpcuts.test');
    await page.getByLabel('Town or city').fill('Leeds');
    await page.getByRole('button', { name: 'Send my request' }).click();
    await expect(page.getByRole('status')).toContainText('Request sent');

    const emailRes = await request.get('/__qa/emails');
    const emailJson = await emailRes.json();
    expect(emailJson.emails[0].provider).toBe('dev-log');
    expect(emailJson.emails[0].subject).toBe("We're designing your Sharp Cuts website");
    expect(emailJson.emails[0].html).toContain('Open your shop hub');
    const token = emailJson.token as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    await page.goto(`/preview/${token}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: "We've got your request" })).toBeVisible();
    await expect(page.locator('.hub-private--mobile')).toBeVisible();
    await page.screenshot({ path: join(shotDir, 'journey-overview-360.png'), fullPage: true });

    await page.goto(`/preview/${token}/details`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('logo-input').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await page.getByRole('button', { name: 'Upload logo' }).click();
    await expect(page.locator('#logo-status')).toContainText('Saved');
    await page.getByTestId('photos-input').setInputFiles([
      { name: 'chair.png', mimeType: 'image/png', buffer: PNG },
      { name: 'cut.png', mimeType: 'image/png', buffer: PNG },
      { name: 'shop.png', mimeType: 'image/png', buffer: PNG },
    ]);
    await page.getByRole('button', { name: 'Upload photos' }).click();
    await expect(page.locator('#photos-status')).toContainText('Saved');

    await page.goto(`/preview/${token}/messages`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Got a question or something we should know?')).toBeVisible();
    await page.getByTestId('message-body').fill('Here is our logo and shop photos.');
    await page.getByTestId('send-message').click();
    await expect(page.getByRole('status')).toContainText('Sent');

    expect((await request.post(`/__qa/ops/${token}/mark-ready`)).ok()).toBeTruthy();

    await page.goto(`/preview/${token}/details`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('confirm-services').click();
    await expect(page.locator('#services-result')).toContainText('Confirmed');
    await page.getByTestId('monday-open').fill('10:00');
    await page.getByTestId('correct-hours').click();
    await expect(page.locator('#hours-result')).toContainText('Corrections sent');

    await page.goto(`/preview/${token}/changes`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('change-page').selectOption('HOME');
    await page.getByTestId('change-body').fill('Make the Book an appointment button larger.');
    await page.getByTestId('save-draft').click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await page.getByTestId('change-page').selectOption('SERVICES');
    await page.getByTestId('change-body').fill('Show prices on the services cards.');
    await page.getByTestId('save-draft').click();
    await page.getByTestId('send-changes').click();
    await expect(page.getByRole('status')).toContainText('Changes sent');

    expect((await request.post(`/__qa/ops/${token}/apply`)).ok()).toBeTruthy();
    expect((await request.post(`/__qa/ops/${token}/changes-done`)).ok()).toBeTruthy();

    await page.goto(`/preview/${token}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('subscribe').click();
    await expect(page).toHaveURL(new RegExp(`/admin/preview-launch\\?token=${token}`));
    await expect(page.getByRole('heading', { name: 'Launch checklist' })).toBeVisible();
    await expect(page.getByText('Is your shop a limited company?')).toBeVisible();
    await expect(page.getByTestId('ltd-no')).toBeChecked();
    await expect(page.getByLabel('Registered company name')).toHaveCount(0);
    await page.getByTestId('skip-payments').click();
    await page.getByTestId('skip-migration').click();
    await page.getByTestId('rights').check();
    await page.getByTestId('accuracy').check();
    await page.getByTestId('approve-launch').click();
    await expect(page.getByRole('status')).toContainText("we'll put Sharp Cuts live");

    expect((await request.post(`/__qa/ops/${token}/mark-live`)).ok()).toBeTruthy();
    await page.goto(`/preview/${token}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Sharp Cuts is live' })).toBeVisible();
    await expect(page.getByText('Next in your dashboard')).toBeVisible();

    const finalState = await (await request.get(`/__qa/state?token=${token}`)).json();
    expect(finalState.assets).toHaveLength(4);
    expect(finalState.messages).toHaveLength(1);
    expect(finalState.reviews.SERVICES).toBe('CONFIRMED');
    expect(finalState.reviews.HOURS).toBe('APPLIED');
    expect(finalState.changes).toHaveLength(2);
    expect(finalState.changes.every((row: { status: string }) => row.status === 'DONE')).toBe(true);
    expect(finalState.hoursOpen).toBe('10:00');
    expect(finalState.stage).toBe('live');

    const tokens = await (await request.get('/__qa/tokens')).json();
    expect((await request.get(`/preview/${tokens.rejected}`)).status()).toBe(404);
    expect((await request.get(`/preview/${tokens.expired}`)).status()).toBe(410);
    expect((await request.get(`/api/preview-hub/${token}/assets/${tokens.otherAsset}`)).status()).toBe(404);
    expect((await request.get(`/api/preview-hub/${tokens.other}/assets/asset_1`)).status()).toBe(404);
  });

  test('axe: zero serious or critical on every hub screen and the checklist', async ({ page }) => {
    const screens = [
      'overview',
      'details',
      'detailsReview',
      'website',
      'changes',
      'messages',
      'checklist',
      'live',
      'expired',
    ];
    for (const name of screens) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/screens/${name}`, { waitUntil: 'domcontentloaded' });
      await expectNoSeriousAxe(page, `${name}-390`);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/screens/${name}`, { waitUntil: 'domcontentloaded' });
      await expectNoSeriousAxe(page, `${name}-1280`);
    }
  });
});
