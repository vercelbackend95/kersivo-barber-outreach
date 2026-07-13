/**
 * Standalone production consent verification (no Playwright test runner).
 * Usage: node scripts/run-consent-verify.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://kersivo.co.uk';
const REPORT = [];

function log(section, data) {
  const entry = { section, ...data, at: new Date().toISOString() };
  REPORT.push(entry);
  console.log(JSON.stringify(entry));
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
  const consent = cookies.find((c) => c.name === 'kersivo_consent');
  return {
    cookies: cookies.map((c) => ({ name: c.name, domain: c.domain })),
    localStorageKeys: Object.keys(storage.localStorage),
    sessionStorageKeys: Object.keys(storage.sessionStorage),
    consentCookie: consent ? decodeURIComponent(consent.value) : null,
  };
}

async function waitForBanner(page) {
  await page.getByRole('heading', { name: 'Your privacy choices' }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Accept all' }).waitFor();
  await page.getByRole('button', { name: 'Reject optional' }).waitFor();
  await page.getByRole('button', { name: 'Manage preferences' }).waitFor();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const failures = [];

  // 1 Fresh visit
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const tracking = [];
    page.on('request', (req) => {
      if (isGoogleTracking(req.url())) tracking.push(req.url());
    });
    try {
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
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
      log('fresh_visit', { trackingRequests: tracking, optionalCookies, boot, storage: snap });
      assert(tracking.length === 0, `pre-consent tracking: ${tracking.join('\n')}`);
      assert(optionalCookies.length === 0, 'optional cookies before consent');
      assert(boot.hasDefaultDenied, 'missing consent defaults');
      assert(boot.gaId === 'G-6QEN5JL0L1', `wrong GA id: ${boot.gaId}`);
    } catch (e) {
      failures.push(`fresh_visit: ${e.message}`);
      log('fresh_visit_error', { error: e.message });
    }
    await browser.close();
  }

  // 2 Reject
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const tracking = [];
    page.on('request', (req) => {
      if (isGoogleTracking(req.url())) tracking.push(req.url());
    });
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForBanner(page);
      await page.getByRole('button', { name: 'Reject optional' }).click();
      await page.getByRole('heading', { name: 'Your privacy choices' }).waitFor({ state: 'hidden', timeout: 10000 });
      await page.waitForTimeout(2000);
      let snap = await snapshotStorage(page);
      const prefs = JSON.parse(snap.consentCookie);
      assert(prefs.analytics === false && prefs.advertisingMeasurement === false, 'reject prefs');
      assert(tracking.length === 0, 'tracking after reject');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      assert((await page.getByRole('heading', { name: 'Your privacy choices' }).count()) === 0, 'banner returned after reject reload');
      await page.goto(BASE + '/privacy', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      assert(tracking.length === 0, 'tracking after nav');
      await page.getByRole('button', { name: 'Cookie settings' }).click();
      await page.getByRole('heading', { name: 'Cookie preferences' }).waitFor();
      const switches = page.locator('.cookie-consent__switch input');
      assert(!(await switches.nth(0).isChecked()), 'analytics should be off');
      assert(!(await switches.nth(1).isChecked()), 'ads should be off');
      log('reject', { prefs, tracking });
    } catch (e) {
      failures.push(`reject: ${e.message}`);
      log('reject_error', { error: e.message });
    }
    await browser.close();
  }

  // 3 Analytics only
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const gtagLoads = [];
    page.on('request', (req) => {
      if (req.url().includes('googletagmanager.com/gtag/js')) gtagLoads.push(req.url());
    });
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForBanner(page);
      await page.getByRole('button', { name: 'Manage preferences' }).click();
      const switches = page.locator('.cookie-consent__switch input');
      await switches.nth(0).check({ force: true });
      assert(!(await switches.nth(1).isChecked()), 'ads should stay off');
      await page.getByRole('button', { name: 'Save choices' }).click();
      await page.waitForTimeout(5000);
      const snap = await snapshotStorage(page);
      const prefs = JSON.parse(snap.consentCookie);
      const gcl = snap.cookies.filter((c) => c.name.startsWith('_gcl'));
      assert(prefs.analytics === true, 'analytics not granted');
      assert(prefs.advertisingMeasurement === false, 'ads unexpectedly granted');
      assert(gtagLoads.some((u) => u.includes('G-6QEN5JL0L1')), 'GA4 script missing');
      assert(gcl.length === 0, 'gcl cookies present');
      const beforeReload = gtagLoads.length;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      log('analytics_only', {
        prefs,
        gtagLoads: [...new Set(gtagLoads)],
        loadCount: gtagLoads.length,
        beforeReload,
        gaCookies: snap.cookies.filter((c) => c.name.startsWith('_ga') || c.name === '_gid'),
      });
    } catch (e) {
      failures.push(`analytics_only: ${e.message}`);
      log('analytics_only_error', { error: e.message });
    }
    await browser.close();
  }

  // 4 Ads preference without ID
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const adsRequests = [];
    page.on('request', (req) => {
      if (req.url().includes('AW-')) adsRequests.push(req.url());
    });
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForBanner(page);
      await page.getByRole('button', { name: 'Manage preferences' }).click();
      await page.locator('.cookie-consent__switch input').nth(1).check({ force: true });
      await page.getByRole('button', { name: 'Save choices' }).click();
      await page.waitForTimeout(3000);
      const prefs = JSON.parse((await snapshotStorage(page)).consentCookie);
      assert(prefs.advertisingMeasurement === true, 'ads measurement not saved');
      assert(prefs.personalisedAdvertising === false, 'personalisation should be false');
      assert(adsRequests.length === 0, 'unexpected AW requests');
      log('ads_deferred', { prefs, adsRequests });
    } catch (e) {
      failures.push(`ads_deferred: ${e.message}`);
      log('ads_deferred_error', { error: e.message });
    }
    await browser.close();
  }

  // 5 Accept all
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const gtagLoads = [];
    page.on('request', (req) => {
      if (req.url().includes('googletagmanager.com/gtag/js')) gtagLoads.push(req.url());
    });
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForBanner(page);
      await page.getByRole('button', { name: 'Accept all' }).click();
      await page.waitForTimeout(5000);
      const prefs = JSON.parse((await snapshotStorage(page)).consentCookie);
      assert(prefs.analytics && prefs.advertisingMeasurement, 'accept all prefs');
      assert(prefs.personalisedAdvertising === false, 'personalisation');
      assert(!gtagLoads.some((u) => u.includes('AW-')), 'AW loaded without ID');
      assert(gtagLoads.some((u) => u.includes('G-6QEN5JL0L1')), 'GA missing on accept all');
      log('accept_all', { prefs, gtagLoads: [...new Set(gtagLoads)] });
    } catch (e) {
      failures.push(`accept_all: ${e.message}`);
      log('accept_all_error', { error: e.message });
    }
    await browser.close();
  }

  // 6 Withdraw
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForBanner(page);
      await page.getByRole('button', { name: 'Accept all' }).click();
      await page.waitForTimeout(4000);
      await page.evaluate(() => localStorage.setItem('kersivo_shop_cart_v2', '[{"productId":"test"}]'));
      await page.locator('.cookie-consent__launcher').click();
      await page.getByRole('button', { name: 'Reject optional' }).click();
      await page.waitForTimeout(2000);
      const snap = await snapshotStorage(page);
      const prefs = JSON.parse(snap.consentCookie);
      assert(!prefs.analytics && !prefs.advertisingMeasurement, 'withdraw prefs');
      assert(snap.localStorageKeys.includes('kersivo_shop_cart_v2'), 'cart deleted');
      assert(Boolean(snap.consentCookie), 'consent cookie missing');
      log('withdraw', {
        prefs,
        optionalLeft: snap.cookies.filter((c) =>
          ['_ga', '_gid', '_gcl'].some((p) => c.name === p || c.name.startsWith(p)),
        ),
        cartKept: true,
      });
    } catch (e) {
      failures.push(`withdraw: ${e.message}`);
      log('withdraw_error', { error: e.message });
    }
    await browser.close();
  }

  // 7 Viewports + Escape
  {
    const browser = await chromium.launch();
    try {
      for (const width of [320, 375, 768, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 720 } });
        const page = await context.newPage();
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await waitForBanner(page);
        const acceptBox = await page.getByRole('button', { name: 'Accept all' }).boundingBox();
        const rejectBox = await page.getByRole('button', { name: 'Reject optional' }).boundingBox();
        assert((acceptBox?.width || 0) > 40, `accept cut off at ${width}`);
        assert((rejectBox?.width || 0) > 40, `reject cut off at ${width}`);
        await page.getByRole('button', { name: 'Manage preferences' }).click();
        await page.getByRole('heading', { name: 'Cookie preferences' }).waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('heading', { name: 'Your privacy choices' }).waitFor();
        log('viewport', { width, ok: true });
        await context.close();
      }
    } catch (e) {
      failures.push(`viewport: ${e.message}`);
      log('viewport_error', { error: e.message });
    }
    await browser.close();
  }

  // 8 Soft regressions + policy checks
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const tracking = [];
    page.on('request', (req) => {
      if (isGoogleTracking(req.url())) tracking.push(req.url());
    });
    try {
      for (const path of ['/', '/shop', '/setup/cancel', '/setup/success', '/cookies', '/privacy']) {
        const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
        assert(res && res.status() < 400, `${path} status ${res?.status()}`);
        log('page', { path, status: res.status() });
      }
      const privacy = await page.content();
      assert(privacy.includes('Neon'), 'privacy missing Neon');
      assert(!privacy.includes('We do not use third-party tracking'), 'false privacy claim');
      assert(!/remarketing is active/i.test(privacy), 'remarketing claim');
      assert(!/Enhanced Conversions are active/i.test(privacy), 'EC claim');
      const cookiesHtml = await page.content();
      assert(cookiesHtml.includes('kersivo_consent'), 'cookie policy missing consent cookie');
      // already on /cookies from loop; privacy checked above
      await page.goto(BASE + '/setup/success', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      assert(
        tracking.filter((u) => u.includes('googletagmanager.com/gtag/js')).length === 0,
        'gtag loaded on success without consent',
      );
      log('regressions', { ok: true, trackingCount: tracking.length });
    } catch (e) {
      failures.push(`regressions: ${e.message}`);
      log('regressions_error', { error: e.message });
    }
    await browser.close();
  }

  fs.writeFileSync(
    'scripts/consent-verify-report.json',
    JSON.stringify({ failures, REPORT }, null, 2),
  );
  console.log('\nFAILURES:', failures.length ? failures : 'none');
  if (failures.length) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
