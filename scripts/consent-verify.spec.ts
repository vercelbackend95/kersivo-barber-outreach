/**
 * Ephemeral production consent verification for https://kersivo.co.uk/
 * Run: npx playwright test --config=scripts/consent-verify.playwright.config.mjs
 */
import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'https://kersivo.co.uk';
const REPORT = [];

function log(section, data) {
  REPORT.push({ section, ...data, at: new Date().toISOString() });
  console.log(JSON.stringify({ section, ...data }));
}

function isGoogleTracking(url) {
  const u = url.toLowerCase();
  return (
    u.includes('googletagmanager.com/gtag/js') ||
    u.includes('google-analytics.com') ||
    u.includes('/g/collect') ||
    u.includes('analytics.google.com') ||
    (u.includes('googleadservices.com') && u.includes('pagead'))
  );
}

async function snapshotStorage(page) {
  const cookies = await page.context().cookies();
  const storage = await page.evaluate(() => ({
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
  }));
  return {
    cookies: cookies.map((c) => ({ name: c.name, domain: c.domain, expires: c.expires })),
    localStorageKeys: Object.keys(storage.localStorage),
    sessionStorageKeys: Object.keys(storage.sessionStorage),
    consentCookie: cookies.find((c) => c.name === 'kersivo_consent')?.value
      ? decodeURIComponent(cookies.find((c) => c.name === 'kersivo_consent').value)
      : null,
  };
}

async function waitForBanner(page) {
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject optional' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage preferences' })).toBeVisible();
}

test.describe.configure({ mode: 'serial', timeout: 120000 });

test('1 fresh visit before consent', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const tracking = [];
  page.on('request', (req) => {
    if (isGoogleTracking(req.url())) tracking.push(req.url());
  });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await waitForBanner(page);

  const boot = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    return {
      hasDefaultDenied: html.includes("analytics_storage: 'denied'"),
      gaId: (html.match(/gaMeasurementId = "([^"]*)"/) || [])[1] || null,
    };
  });

  const snap = await snapshotStorage(page);
  const optionalCookies = snap.cookies.filter((c) =>
    ['_ga', '_gid', '_gcl'].some((p) => c.name === p || c.name.startsWith(p)),
  );

  log('fresh_visit', {
    trackingRequests: tracking,
    optionalCookies,
    storage: snap,
    boot,
  });

  expect(tracking.length, `unexpected tracking: ${tracking.join('\n')}`).toBe(0);
  expect(optionalCookies.length).toBe(0);
  expect(boot.hasDefaultDenied).toBe(true);
  expect(boot.gaId).toBe('G-6QEN5JL0L1');

  await browser.close();
});

test('2 reject optional + persistence', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const tracking = [];
  page.on('request', (req) => {
    if (isGoogleTracking(req.url())) tracking.push(req.url());
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitForBanner(page);
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).toBeHidden({
    timeout: 10000,
  });
  await page.waitForTimeout(2000);

  let snap = await snapshotStorage(page);
  const prefs = snap.consentCookie ? JSON.parse(snap.consentCookie) : null;
  log('reject', { prefs, trackingAfterReject: [...tracking], storage: snap });
  expect(prefs?.analytics).toBe(false);
  expect(prefs?.advertisingMeasurement).toBe(false);
  expect(tracking.length).toBe(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).toHaveCount(0);
  expect(tracking.length).toBe(0);

  await page.goto(BASE + '/privacy', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  expect(tracking.length).toBe(0);

  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await expect(page.getByRole('heading', { name: 'Cookie preferences' })).toBeVisible();
  const analyticsSwitch = page.locator('#cookie-analytics-label').locator('..').locator('input');
  const adsSwitch = page.locator('#cookie-ads-label').locator('..').locator('input');
  // switches are siblings under category-head
  const switches = page.locator('.cookie-consent__switch input');
  await expect(switches.nth(0)).not.toBeChecked();
  await expect(switches.nth(1)).not.toBeChecked();

  log('reject_persistence', { tracking, prefs: await snapshotStorage(page) });
  await browser.close();
});

test('3 analytics-only', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const gtagLoads = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('googletagmanager.com/gtag/js')) gtagLoads.push(u);
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitForBanner(page);
  await page.getByRole('button', { name: 'Manage preferences' }).click();
  await expect(page.getByRole('heading', { name: 'Cookie preferences' })).toBeVisible();

  const switches = page.locator('.cookie-consent__switch input');
  await switches.nth(0).check();
  await expect(switches.nth(1)).not.toBeChecked();
  await page.getByRole('button', { name: 'Save choices' }).click();
  await page.waitForTimeout(4000);

  const snap = await snapshotStorage(page);
  const prefs = JSON.parse(snap.consentCookie);
  const gaCookies = snap.cookies.filter((c) => c.name === '_ga' || c.name.startsWith('_ga') || c.name === '_gid');
  const gcl = snap.cookies.filter((c) => c.name.startsWith('_gcl'));

  log('analytics_only', {
    prefs,
    gtagLoads,
    gaCookies,
    gcl,
    uniqueGtag: [...new Set(gtagLoads)],
  });

  expect(prefs.analytics).toBe(true);
  expect(prefs.advertisingMeasurement).toBe(false);
  expect(gtagLoads.some((u) => u.includes('G-6QEN5JL0L1'))).toBe(true);
  expect(new Set(gtagLoads.map((u) => u.split('?')[0])).size).toBeLessThanOrEqual(1);
  expect(gcl.length).toBe(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const afterReload = gtagLoads.filter((u) => u.includes('G-6QEN5JL0L1')).length;
  log('analytics_reload', { gtagLoadCount: afterReload });

  await browser.close();
});

test('4 advertising measurement without Ads ID', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const adsRequests = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('AW-') || (u.includes('googletagmanager.com/gtag/js') && u.includes('AW-'))) {
      adsRequests.push(u);
    }
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitForBanner(page);
  await page.getByRole('button', { name: 'Manage preferences' }).click();
  const switches = page.locator('.cookie-consent__switch input');
  await switches.nth(1).check();
  await page.getByRole('button', { name: 'Save choices' }).click();
  await page.waitForTimeout(3000);

  const prefs = JSON.parse((await snapshotStorage(page)).consentCookie);
  log('ads_measurement_no_id', { prefs, adsRequests });
  expect(prefs.advertisingMeasurement).toBe(true);
  expect(prefs.personalisedAdvertising).toBe(false);
  expect(adsRequests.length).toBe(0);
  await browser.close();
});

test('5 accept all', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const gtagLoads = [];
  page.on('request', (req) => {
    if (req.url().includes('googletagmanager.com/gtag/js')) gtagLoads.push(req.url());
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitForBanner(page);
  await page.getByRole('button', { name: 'Accept all' }).click();
  await page.waitForTimeout(4000);

  const prefs = JSON.parse((await snapshotStorage(page)).consentCookie);
  log('accept_all', { prefs, gtagLoads: [...new Set(gtagLoads)] });
  expect(prefs.analytics).toBe(true);
  expect(prefs.advertisingMeasurement).toBe(true);
  expect(prefs.personalisedAdvertising).toBe(false);
  expect(gtagLoads.filter((u) => u.includes('AW-')).length).toBe(0);
  expect(gtagLoads.some((u) => u.includes('G-6QEN5JL0L1'))).toBe(true);
  await browser.close();
});

test('6 withdraw consent', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitForBanner(page);
  await page.getByRole('button', { name: 'Accept all' }).click();
  await page.waitForTimeout(4000);

  // seed essential cart storage
  await page.evaluate(() => {
    localStorage.setItem('kersivo_shop_cart_v2', '[{"productId":"test"}]');
  });

  await page.getByRole('button', { name: 'Cookie settings' }).click();
  const switches = page.locator('.cookie-consent__switch input');
  if (await switches.nth(0).isChecked()) await switches.nth(0).uncheck();
  if (await switches.nth(1).isChecked()) await switches.nth(1).uncheck();
  await page.getByRole('button', { name: 'Save choices' }).click();
  await page.waitForTimeout(2000);

  const snap = await snapshotStorage(page);
  const prefs = JSON.parse(snap.consentCookie);
  const optional = snap.cookies.filter((c) =>
    ['_ga', '_gid', '_gcl'].some((p) => c.name === p || c.name.startsWith(p + '_') || c.name.startsWith(p)),
  );
  const cartKept = snap.localStorageKeys.includes('kersivo_shop_cart_v2');

  log('withdraw', { prefs, optionalCookiesLeft: optional, cartKept, sessionKeys: snap.sessionStorageKeys });
  expect(prefs.analytics).toBe(false);
  expect(prefs.advertisingMeasurement).toBe(false);
  expect(cartKept).toBe(true);
  // Google may leave third-party domain cookies; first-party optional should be cleared when possible
  await browser.close();
});

test('7 mobile viewports + escape', async () => {
  const browser = await chromium.launch();
  for (const width of [320, 375, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 720 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await waitForBanner(page);
    const acceptBox = await page.getByRole('button', { name: 'Accept all' }).boundingBox();
    const rejectBox = await page.getByRole('button', { name: 'Reject optional' }).boundingBox();
    expect(acceptBox?.width).toBeGreaterThan(40);
    expect(rejectBox?.width).toBeGreaterThan(40);

    await page.getByRole('button', { name: 'Manage preferences' }).click();
    await expect(page.getByRole('heading', { name: 'Cookie preferences' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Escape without consent should return to banner (no decision yet)
    await expect(page.getByRole('heading', { name: 'Your privacy choices' })).toBeVisible();
    log('viewport', { width, ok: true });
    await context.close();
  }
  await browser.close();
});

test('8 soft regressions', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const tracking = [];
  page.on('request', (req) => {
    if (isGoogleTracking(req.url())) tracking.push(req.url());
  });

  for (const path of ['/', '/shop', '/setup/cancel', '/setup/success', '/cookies', '/privacy']) {
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    expect(res?.ok() || res?.status() === 200 || res?.status() === 304).toBeTruthy();
    log('page', { path, status: res?.status() });
  }

  // success without session should not fire conversion before consent
  await page.goto(BASE + '/setup/success', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const conversionHits = tracking.filter((u) => u.includes('setup_deposit_paid') || u.includes('collect'));
  log('success_no_consent', { conversionHits, trackingCount: tracking.length });
  expect(tracking.filter((u) => u.includes('googletagmanager.com/gtag/js')).length).toBe(0);

  await browser.close();
});

test.afterAll(() => {
  fs.writeFileSync('scripts/consent-verify-report.json', JSON.stringify(REPORT, null, 2));
});
