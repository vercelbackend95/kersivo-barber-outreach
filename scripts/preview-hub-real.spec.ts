import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = join(root, 'docs/preview-hub/screens/batch-7');
mkdirSync(shotDir, { recursive: true });

type Seed = {
  ops: { email: string; password: string };
  owner: { email: string; password: string };
  requested: { id: string; token: string };
  ready: { id: string; token: string; shopId: string };
  converted: { id: string; token: string };
  rejected: { id: string; token: string };
  expired: { id: string; token: string };
};

async function loadSeed(page: Page): Promise<Seed> {
  const res = await page.request.get('/api/preview-hub-qa/seed');
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Seed;
}

function jpegWithGps(jpeg: Buffer): Buffer {
  const app1Body = Buffer.from([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00, 0x4e, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00,
  ]);
  const app1 = Buffer.alloc(4 + app1Body.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(app1.length - 2, 2);
  app1Body.copy(app1, 4);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function bigGpsJpeg(): Promise<Buffer> {
  const raw = await sharp({
    create: { width: 4200, height: 3200, channels: 3, background: { r: 40, g: 90, b: 70 } },
  })
    .jpeg({ quality: 98 })
    .toBuffer();
  const out = jpegWithGps(raw);
  if (out.length >= 6 * 1024 * 1024) return out;
  const pad = Buffer.alloc(6 * 1024 * 1024 - out.length, 0xff);
  return Buffer.concat([out, pad]);
}

async function logoPng(): Promise<Buffer> {
  return sharp({
    create: { width: 240, height: 240, channels: 3, background: { r: 215, g: 38, b: 56 } },
  })
    .png()
    .toBuffer();
}

async function expectNoSeriousAxe(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) {
    writeFileSync(join(shotDir, `axe-${name}.json`), JSON.stringify(serious, null, 2));
  }
  expect(serious, `${name} axe serious/critical`).toEqual([]);
}

async function shot(page: Page, name: string, width: 360 | 1280) {
  const previous = page.viewportSize();
  await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
  await page.screenshot({ path: join(shotDir, `${name}-${width}.png`), fullPage: true });
  if (previous) await page.setViewportSize(previous);
}

async function signOut(page: Page) {
  await page.context().clearCookies();
}

async function fillHubMessage(page: Page, text: string) {
  const body = page.getByTestId('hub-message-body');
  await expect(body).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take a photo' }).first()).toBeVisible({ timeout: 15000 });
  await expect
    .poll(
      async () => {
        await body.click();
        await body.fill(text);
        return body.inputValue();
      },
      { timeout: 15000 },
    )
    .toBe(text);
  await expect(page.getByTestId('hub-send-message')).toBeEnabled();
}

async function signIn(page: Page, email: string, password: string) {
  const res = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: 'http://127.0.0.1:4397', 'Content-Type': 'application/json' },
    data: { email, password },
  });
  expect(res.ok(), `sign-in ${email} ${res.status()}`).toBeTruthy();
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(600000);

test.describe('Shop Hub real stack', () => {
  test.beforeAll(async ({ request }) => {
    let health;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        health = await request.get('/preview-hub-qa/health');
        if (health.ok()) break;
      } catch {
        /* server still swapping */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    expect(health?.ok(), 'QA health').toBeTruthy();
    await request.post('/api/free-preview', {
      headers: { Origin: 'http://127.0.0.1:4397', 'Content-Type': 'application/json' },
      data: { shopName: 'Warm', townCity: 'Leeds', email: 'warmup.hubqa@hubqa.test' },
    });
  });

  test('A: owner journey, uploads, messages, review, changes, checkout, launch, negatives', async ({
    page,
    request,
  }) => {
    const seed = await loadSeed(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/free-preview', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Barbershop name').fill('Hub QA Journey');
    await page.getByLabel('Town or city').fill('Bournemouth');
    const journeyEmail = `journey.${Date.now()}@hubqa.test`;
    await page.getByLabel('Email for your preview link').fill(journeyEmail);
    await page.getByRole('button', { name: 'Get my free preview' }).click();
    const sendWithout = page.getByRole('button', { name: 'Send without a link' });
    await sendWithout.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
    if (await sendWithout.isVisible().catch(() => false)) {
      await sendWithout.click();
    }
    await expect(page.locator('[data-free-preview-confirmation]:not([hidden])')).toBeVisible({
      timeout: 60000,
    });

    const emails = await request.get(`/api/preview-hub-qa/emails?to=${encodeURIComponent(journeyEmail)}`);
    const emailJson = await emails.json();
    const ack = emailJson.emails?.[0];
    expect(ack?.subject ?? '').toContain("We're designing your Hub QA Journey website");
    const html = String(ack?.html ?? '');
    if (html) {
      expect(html).toContain('Open your shop hub');
    }
    const created = await request.get(`/api/preview-hub-qa/request?email=${encodeURIComponent(journeyEmail)}`);
    expect(created.ok()).toBeTruthy();
    const createdJson = (await created.json()) as { token?: string; id?: string };
    const tokenMatch = html.match(/\/preview\/([A-Za-z0-9_-]{43})/);
    const journeyToken = tokenMatch?.[1] || createdJson.token;
    expect(journeyToken).toBeTruthy();

    await page.goto(`/preview/${journeyToken}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: "We've got your request" })).toBeVisible();
    await shot(page, 'overview-requested', 360);
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot(page, 'overview-requested', 1280);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/preview/${journeyToken}/details`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your shop', exact: true })).toBeVisible();
    await expect(page.getByTestId('hub-upload-logo')).toBeAttached();
    await shot(page, 'details-empty', 360);
    await shot(page, 'details-empty', 1280);
    const gpsJpeg = await bigGpsJpeg();
    const png = await logoPng();
    const logoUpload = page.waitForResponse(
      (res) => res.url().includes('/assets') && res.request().method() === 'POST',
      { timeout: 30000 },
    );
    await page.locator('[data-testid="hub-upload-logo"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: png,
    });
    expect((await logoUpload).ok()).toBeTruthy();
    await expect(page.getByText('Pick from my logo')).toBeVisible({ timeout: 20000 });
    const photoUpload = page.waitForResponse(
      (res) => res.url().includes('/assets') && res.request().method() === 'POST',
      { timeout: 60000 },
    );
    await page.locator('[data-testid="hub-upload-shop_photo"]').setInputFiles({
      name: 'shop.jpg',
      mimeType: 'image/jpeg',
      buffer: gpsJpeg,
    });
    expect((await photoUpload).ok()).toBeTruthy();
    await expect(page.getByText('Uploading 1 file')).toHaveCount(0, { timeout: 15000 });

    const assetsRes = await request.get(`/api/preview-hub/${journeyToken}/assets`);
    const assetsJson = await assetsRes.json();
    const photo = (assetsJson.assets as Array<{ id: string; kind: string }>).find((row) => row.kind === 'SHOP_PHOTO');
    expect(photo).toBeTruthy();
    const fileRes = await request.get(`/api/preview-hub/${journeyToken}/assets/${photo!.id}?size=full`);
    expect(fileRes.ok()).toBeTruthy();
    const stored = Buffer.from(await fileRes.body());
    expect(stored.length).toBeLessThan(4 * 1024 * 1024);
    const meta = await sharp(stored).metadata();
    expect(meta.exif).toBeUndefined();

    await page.goto(`/preview/${journeyToken}/messages`, { waitUntil: 'domcontentloaded' });
    await fillHubMessage(page, 'Here is our logo and a shop photo.');
    await page.locator('[data-testid="hub-upload-message_attachment"]').setInputFiles({
      name: 'note.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await expect(page.getByText(/note\.(png|jpg|jpeg|webp)/i)).toBeVisible({ timeout: 15000 });
    await page.getByTestId('hub-send-message').click();
    await expect(page.getByText('Here is our logo and a shop photo.')).toBeVisible();

    const journeyId = createdJson.id;
    expect(journeyId).toBeTruthy();
    await signIn(page, seed.ops.email, seed.ops.password);
    await page.goto(`/ops/preview-requests/${journeyId}?tab=messages`, { waitUntil: 'domcontentloaded' });
    await fillHubMessage(page, 'Thanks — we have your files.');
    await page.getByTestId('hub-send-message').click();
    await expect(page.getByText('Thanks — we have your files.')).toBeVisible({ timeout: 15000 });
    await signOut(page);

    await page.goto(`/preview/${journeyToken}/messages`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hub-msg__body', { hasText: 'Thanks — we have your files.' })).toBeVisible({
      timeout: 15000,
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hub-msg__seen', { hasText: 'Seen' })).toBeVisible({ timeout: 15000 });

    await page.goto(`/preview/${seed.ready.token}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your preview is ready' })).toBeVisible();
    await shot(page, 'overview-review', 360);
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot(page, 'overview-review', 1280);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/preview/${seed.ready.token}/details`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'details-filled', 360);
    await shot(page, 'details-filled', 1280);
    const price = page.locator('#hub-review-services input[inputmode="decimal"]').first();
    await expect(price).toBeVisible({ timeout: 15000 });
    await expect
      .poll(
        async () => {
          await price.fill('25.00');
          return price.inputValue();
        },
        { timeout: 15000 },
      )
      .toBe('25.00');
    await expect(page.getByText('Unsaved changes').first()).toBeVisible();
    await expect(page.getByTestId('hub-review-services-looks-right')).toBeDisabled();
    await page.getByTestId('hub-review-services-send-corrections').click();
    await expect(page.getByText('Corrections sent').first()).toBeVisible({ timeout: 15000 });

    const sundaySwitch = page.locator('[aria-labelledby="hub-hours-day-7"]');
    await expect(sundaySwitch).toBeVisible({ timeout: 15000 });
    await expect
      .poll(
        async () => {
          if ((await sundaySwitch.getAttribute('aria-checked')) === 'true') await sundaySwitch.click();
          return sundaySwitch.getAttribute('aria-checked');
        },
        { timeout: 15000 },
      )
      .toBe('false');
    await expect(page.locator('#hub-review-hours').getByText('Unsaved changes')).toBeVisible();
    await expect(page.getByTestId('hub-review-hours-send-corrections')).toBeEnabled();
    const hoursSent = page.waitForResponse(
      (res) => res.url().includes('/reviews') && res.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.getByTestId('hub-review-hours-send-corrections').click();
    const hoursRes = await hoursSent;
    expect(hoursRes.ok()).toBeTruthy();
    const hoursBody = hoursRes.request().postDataJSON() as {
      proposal?: { days?: Array<{ dayOfWeek: number; open: boolean }> };
    };
    expect(hoursBody.proposal?.days?.find((day) => day.dayOfWeek === 7)?.open).toBe(false);

    await signIn(page, seed.ops.email, seed.ops.password);
    await page.goto(`/ops/preview-requests/${seed.ready.id}?tab=content`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(2);
    const applyOne = page.waitForResponse(
      (res) => res.url().includes('/reviews') && res.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: 'Apply' }).first().click();
    expect((await applyOne).ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(1, { timeout: 15000 });
    const applyTwo = page.waitForResponse(
      (res) => res.url().includes('/reviews') && res.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: 'Apply' }).click();
    expect((await applyTwo).ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0, { timeout: 15000 });
    await expect
      .poll(
        async () => {
          const hoursRes = await request.get(`/api/preview-hub-qa/hours?shopId=${seed.ready.shopId}`);
          const hoursJson = (await hoursRes.json()) as {
            hours?: Array<{ dayOfWeek: number; open: boolean }>;
          };
          return hoursJson.hours?.find((day) => day.dayOfWeek === 7)?.open;
        },
        { timeout: 15000 },
      )
      .toBe(false);
    await signOut(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/preview/${seed.ready.token}/website?view=booking&t=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText('£25.00').or(page.getByText('£25'))).toBeVisible({ timeout: 15000 });
    await page.getByRole('radio', { name: /Skin fade/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    const barber = page.getByRole('radio', { name: /Any barber|Alex Reed|Jordan Cole/ }).first();
    if (await barber.isVisible().catch(() => false)) {
      await barber.click();
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await expect(page.getByTestId('booking-opening-hours')).toHaveAttribute(
      'data-opening-hours',
      /"dayOfWeek":7,"open":false/,
    );
    const dateField = page.getByLabel('Select booking date');
    await dateField.fill('2026-11-02');
    await expect(page.getByRole('radio', { name: '09:00' }).first()).toBeVisible({ timeout: 15000 });
    await dateField.fill('2026-11-01');
    await expect(page.getByRole('button', { name: /^Sunday,/ }).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('radio', { name: '09:00' })).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByText(/No times available|No available times/i)).toBeVisible();

    await page.goto(`/preview/${seed.ready.token}/website`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'website-phone', 360);
    await shot(page, 'website-phone', 1280);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Desktop' }).click().catch(() => undefined);
    await shot(page, 'website-desktop', 1280);
    await shot(page, 'website-desktop', 360);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/preview/${seed.ready.token}/changes`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Suggest a change' }).click();
    await page.getByTestId('hub-change-body').fill('Make the Book button larger.');
    await page.getByTestId('hub-save-draft').click();
    await page.getByRole('button', { name: 'Suggest a change' }).click();
    await page.getByTestId('hub-change-body').fill('Show prices on the service cards.');
    await page.getByTestId('hub-save-draft').click();
    await page.getByTestId('hub-send-changes').click();
    await expect(page.getByText("You've used your included round of changes")).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Suggest a change' }).click();
    await page.getByTestId('hub-change-body').fill('Second round please.');
    await page.getByTestId('hub-save-draft').click();
    await expect(page.getByTestId('hub-send-changes')).toBeDisabled();
    await shot(page, 'changes', 360);
    await shot(page, 'changes', 1280);

    await signIn(page, seed.ops.email, seed.ops.password);
    await page.goto(`/ops/preview-requests/${seed.ready.id}?tab=changes`, { waitUntil: 'domcontentloaded' });
    const granted = page.waitForResponse(
      (res) => res.url().includes('/grant-round') && res.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: 'Grant extra round' }).click();
    expect((await granted).ok()).toBeTruthy();
    await expect(page.getByText('Extra round granted')).toBeVisible({ timeout: 15000 });
    await signOut(page);
    await page.goto(`/preview/${seed.ready.token}/changes`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('hub-send-changes')).toBeEnabled({ timeout: 15000 });
    await page.getByTestId('hub-send-changes').click();
    await expect(page.getByText('Changes sent').or(page.getByText("We're updating your preview"))).toBeVisible({
      timeout: 15000,
    });

    await page.goto(`/preview/${seed.ready.token}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('hub-subscribe').click();
    await page.getByLabel('Your name').fill('Riley');
    await page.getByRole('radio', { name: /I already have a domain/ }).click();
    await page.getByLabel('Your domain').fill('hub-qa-ready.co.uk');
    await page.getByRole('checkbox', { name: /I agree to the/ }).check();
    await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
    await expect(page).toHaveURL(/preview-hub-qa\/stripe-checkout/, { timeout: 20000 });
    const stub = await request.get('/api/preview-hub-qa/stripe');
    const stubJson = await stub.json();
    expect(stubJson.stub?.unitAmount).toBe(3900);
    expect(JSON.stringify(stubJson.stub?.metadata ?? {})).toContain(seed.ready.id);

    await signIn(page, seed.owner.email, seed.owner.password);
    await page.goto('/admin/preview-launch', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Is your shop a limited company?')).toBeVisible();
    await page.getByTestId('ltd-no').check();
    await expect(page.getByText('Registered company name').or(page.getByLabel('Registered company name'))).toHaveCount(0);
    await shot(page, 'checklist-sole', 360);
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot(page, 'checklist-sole', 1280);
    await page.getByTestId('ltd-yes').check();
    await expect(page.getByText(/registered company name/i)).toBeVisible();
    await shot(page, 'checklist-ltd', 360);
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot(page, 'checklist-ltd', 1280);

    await page.getByTestId('ltd-no').check();
    await expect(page.getByText('Registered company name').or(page.getByLabel('Registered company name'))).toHaveCount(0);
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Payments \(optional\)/ }).click();
    await page.getByTestId('skip-payments').click();
    await page.getByRole('button', { name: /Moving your clients/ }).click();
    await page.getByTestId('skip-migration').click();
    await page.getByRole('button', { name: /Approve your website/ }).click();
    const rightsBox = page.getByRole('checkbox', { name: /right to use the photos/i });
    const accuracyBox = page.getByRole('checkbox', { name: /details on my preview/i });
    await expect
      .poll(
        async () => {
          await rightsBox.check();
          await accuracyBox.check();
          return (await rightsBox.isChecked()) && (await accuracyBox.isChecked());
        },
        { timeout: 15000 },
      )
      .toBeTruthy();
    await expect(page.getByTestId('approve-launch')).toBeEnabled({ timeout: 15000 });
    await page.getByTestId('approve-launch').click();
    await expect(page.getByText(/we'll put Hub QA Converted live/i)).toBeVisible({ timeout: 15000 });

    await signIn(page, seed.ops.email, seed.ops.password);
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/ops/preview-requests', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Approved — ready to launch').filter({ visible: true })).toBeVisible();
    await page.goto(`/ops/preview-requests/${seed.converted.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Launch steps' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark live' })).toBeVisible();
    async function confirmOpsLaunchStep(name: string) {
      const posted = page.waitForResponse(
        (res) => res.url().includes('/launch-steps') && res.request().method() === 'POST',
        { timeout: 15000 },
      );
      await page.getByRole('button', { name }).click();
      expect((await posted).ok()).toBeTruthy();
      await page.waitForTimeout(800);
      await expect(page.getByRole('button', { name })).toBeDisabled({ timeout: 15000 });
    }
    await confirmOpsLaunchStep('Domain connected');
    await confirmOpsLaunchStep('SSL active');
    await confirmOpsLaunchStep('Mark live');

    await page.goto(`/preview/${seed.converted.token}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.getByRole('heading', { name: /is live/ })).toBeVisible({ timeout: 15000 });
    await shot(page, 'overview-live', 360);
    await shot(page, 'overview-live', 1280);

    const liveMail = await request.get(`/api/preview-hub-qa/emails?to=${encodeURIComponent(seed.owner.email)}`);
    const liveJson = await liveMail.json();
    expect(JSON.stringify(liveJson.emails ?? [])).toMatch(/live/i);

    expect((await request.get(`/preview/${seed.rejected.token}`)).status()).toBe(404);
    expect((await request.get(`/preview/${'Z'.repeat(43)}`)).status()).toBe(404);
    expect((await request.get(`/preview/${seed.expired.token}`)).status()).toBe(410);

    const readyAssets = await request.get(`/api/preview-hub/${seed.ready.token}/assets`);
    const readyList = await readyAssets.json();
    const readyAssetId = readyList.assets?.[0]?.id;
    if (readyAssetId) {
      expect(
        (await request.get(`/api/preview-hub/${seed.requested.token}/assets/${readyAssetId}?size=full`)).status(),
      ).toBe(404);
    }

    const csrf = await request.post(`/api/preview-hub/${seed.ready.token}/messages`, {
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      data: { body: 'cross site' },
    });
    expect(csrf.status()).toBe(403);
  });

  test('A: axe on real hub screens and checklist', async ({ page }) => {
    const seed = await loadSeed(page);
    const screens: Array<{ name: string; path: string }> = [
      { name: 'overview', path: `/preview/${seed.ready.token}` },
      { name: 'details', path: `/preview/${seed.ready.token}/details` },
      { name: 'website', path: `/preview/${seed.ready.token}/website` },
      { name: 'changes', path: `/preview/${seed.ready.token}/changes` },
      { name: 'messages', path: `/preview/${seed.ready.token}/messages` },
      { name: 'checklist', path: '/admin/preview-launch' },
    ];
    await signIn(page, seed.owner.email, seed.owner.password);
    for (const width of [390, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      for (const screen of screens) {
        await page.goto(screen.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        await expectNoSeriousAxe(page, `${screen.name}-${width}`);
      }
    }
  });

  test('A: remaining real screenshots', async ({ page }) => {
    const seed = await loadSeed(page);
    await signIn(page, seed.ops.email, seed.ops.password);
    const tabs = ['', 'files', 'content', 'changes', 'messages'];
    for (const tab of tabs) {
      const path = `/ops/preview-requests/${seed.ready.id}${tab ? `?tab=${tab}` : ''}`;
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const name = `ops-${tab || 'overview'}`;
      await shot(page, name, 360);
      await shot(page, name, 1280);
    }
    await page.goto(`/preview/${seed.requested.token}/messages`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'messages', 360);
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot(page, 'messages', 1280);
    await page.goto(`/preview/${seed.converted.token}`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'overview-launch', 360);
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot(page, 'overview-launch', 1280);
  });
});
