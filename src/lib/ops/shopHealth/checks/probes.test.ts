import { beforeEach, describe, expect, it, vi } from 'vitest';
import { healthyContext } from '../fixtures';
import { runCheck } from '../run';
import type { ProbeResult } from '../probe';
import type { ShopHealthCheck, ShopHealthContext } from '../types';
import { clearStripeHealthCache, createProbeChecks, htmlLinksTo, noindexSources, websiteTarget, type ProbeDeps } from './probes';

const SITE = 'https://fade-room.co.uk/';
const BOOK = 'https://kersivo.co.uk/book/fade-room';
const DATA = 'https://kersivo.co.uk/api/public/site/fade-room';
const SHOP = 'https://kersivo.co.uk/shop/shop_1';

const ok = (body: string, extra: Partial<Extract<ProbeResult, { ok: true }>> = {}): ProbeResult => ({
  ok: true,
  status: 200,
  headers: {},
  body,
  finalUrl: SITE,
  redirects: 0,
  durationMs: 120,
  certValidTo: new Date('2027-01-30T00:00:00Z'),
  ...extra,
});

const siteData = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    contractVersion: 1,
    business: { name: 'Fade Room' },
    location: { phone: '0161 496 0000', postcode: 'M1 1AA' },
    planFeatures: { onlineBooking: true },
    booking: { available: true, url: BOOK },
    ...over,
  });

const GOOD_SITE = `<html><head><title>Fade Room</title><meta name="robots" content="index,follow"></head>
<body><h1>Fade Room</h1><a href="tel:+441614960000">Call</a><a class="btn" href="${BOOK}">Book now</a></body></html>`;

function setup(pages: Record<string, ProbeResult>, stripe = vi.fn()) {
  const probe = vi.fn(async (url: string) => pages[url] ?? ({ ok: false, code: 'network', reason: 'ECONNREFUSED', durationMs: 5, finalUrl: url } as ProbeResult));
  const deps: ProbeDeps = { probe, stripeAccount: stripe, now: () => new Date('2026-11-04T12:00:00Z').getTime() };
  const checks = Object.fromEntries(createProbeChecks(deps).map((c) => [c.id, c])) as Record<string, ShopHealthCheck>;
  return { probe, checks };
}

const live = (over: Parameters<typeof healthyContext>[0] = {}) =>
  healthyContext({ verifiedDestinationUrl: `${SITE}book`, ...over });

beforeEach(() => clearStripeHealthCache());

describe('targets', () => {
  it('uses the verified destination origin, else the preview URL', () => {
    expect(websiteTarget(live())).toEqual({ url: SITE, source: 'verified' });
    expect(websiteTarget(healthyContext())).toEqual({ url: 'https://fade-room.example.co.uk', source: 'preview' });
    expect(websiteTarget(healthyContext({ shop: { sitePreviewUrl: 'http://insecure.example' } }))).toBeNull();
  });
});

describe('happy path', () => {
  it('every probe check passes on a healthy live shop, and each URL is fetched once', async () => {
    const { probe, checks } = setup(
      {
        [BOOK]: ok('<h1>Book at Fade Room</h1>'),
        [DATA]: ok(siteData()),
        [SITE]: ok(GOOD_SITE),
        [SHOP]: ok('<li>Matt clay</li>'),
      },
      vi.fn().mockResolvedValue({ chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, disabledReason: null, currentlyDue: [] }),
    );
    const ctx = live();
    for (const check of Object.values(checks)) {
      const r = await runCheck(check, ctx);
      expect({ id: check.id, status: r.status }).toEqual({ id: check.id, status: check.id === 'website.preview_up' ? 'skip' : 'pass' });
    }
    expect(probe.mock.calls.map((c) => c[0]).sort()).toEqual([BOOK, DATA, SHOP, SITE].sort());
  });
});

describe('booking.page', () => {
  it('fails when the page is down or shows another shop', async () => {
    const { checks } = setup({});
    expect((await runCheck(checks['booking.page'], live())).message).toBe('The booking page did not load (ECONNREFUSED).');
    const other = setup({ [BOOK]: ok('<h1>Another Barber</h1>') });
    expect((await runCheck(other.checks['booking.page'], live())).status).toBe('fail');
  });

  it('matches HTML-escaped shop names', async () => {
    const { checks } = setup({ ['https://kersivo.co.uk/book/jo-s']: ok('<h1>Jo&#39;s Cuts &amp; Shaves</h1>') });
    const ctx = live({ shop: { name: 'Jo’s Cuts & Shaves', bookingSlug: 'jo-s' } });
    expect((await runCheck(checks['booking.page'], ctx)).status).toBe('pass');
  });

  it('is "after launch" for a draft', async () => {
    const { checks } = setup({});
    expect((await runCheck(checks['booking.page'], healthyContext({ mode: 'PRELAUNCH' }))).status).toBe('after_launch');
  });
});

describe('website.site_data', () => {
  it('fails on wrong contract version or online booking off', async () => {
    let s = setup({ [DATA]: ok(siteData({ contractVersion: 2 })) });
    expect((await runCheck(s.checks['website.site_data'], live())).status).toBe('fail');
    s = setup({ [DATA]: ok(siteData({ planFeatures: { onlineBooking: false } })) });
    expect((await runCheck(s.checks['website.site_data'], live())).message).toMatch(/online booking is off/);
  });

  it('does not apply without BRANDED_SITE', async () => {
    const { checks } = setup({});
    const starter = live({ access: { state: 'FREE_BOOKING', capabilities: ['PUBLIC_BOOKING'] } });
    expect((await runCheck(checks['website.site_data'], starter)).status).toBe('skip');
  });
});

describe('website.up', () => {
  it('fails when down, warns when slower than 3 s', async () => {
    expect((await runCheck(setup({}).checks['website.up'], live())).status).toBe('fail');
    const slow = setup({ [SITE]: ok(GOOD_SITE, { durationMs: 4200 }) });
    const r = await runCheck(slow.checks['website.up'], live());
    expect(r).toMatchObject({ status: 'warn', message: 'The website is up but slow (4.2 s).' });
  });

  it('does not apply to a live shop with no website', async () => {
    const ctx = healthyContext({ shop: { sitePreviewUrl: null } });
    expect((await runCheck(setup({}).checks['website.up'], ctx)).status).toBe('skip');
  });
});

describe('website.booking_link', () => {
  it('fails when the site has no link to the booking URL from site data', async () => {
    const { checks } = setup({ [SITE]: ok('<a href="https://kersivo.co.uk/book/someone-else">Book</a>'), [DATA]: ok(siteData()) });
    expect((await runCheck(checks['website.booking_link'], live())).status).toBe('fail');
  });

  it('accepts a trailing slash or a relative link on the same origin', () => {
    expect(htmlLinksTo(`<a href="${BOOK}/">x</a>`, BOOK, SITE)).toBe(true);
    expect(htmlLinksTo('<a href="/book">x</a>', 'https://fade-room.co.uk/book', SITE)).toBe(true);
    expect(htmlLinksTo('<a href="/book">x</a>', BOOK, SITE)).toBe(false);
  });
});

describe('website.indexable', () => {
  it.each([
    ['<meta name="robots" content="noindex, nofollow">', {}],
    ["<meta content='noindex' name='robots'>", {}],
    ['<meta name="googlebot" content="NOINDEX">', {}],
    ['<meta name=robots content="noindex">', {}],
    ['', { 'x-robots-tag': 'noindex' }],
    ['', { 'x-robots-tag': 'googlebot: noindex, nofollow' }],
  ])('detects noindex in %s %j', (html, headers) => {
    expect(noindexSources(`<head>${html}</head>`, headers as Record<string, string>).length).toBeGreaterThan(0);
  });

  it.each([
    ['<meta name="robots" content="index, follow">', {}],
    ['<meta name="description" content="noindex is not here">', {}],
    ['', { 'x-robots-tag': 'all' }],
  ])('passes %s %j', (html, headers) => {
    expect(noindexSources(`<head>${html}</head>`, headers as Record<string, string>)).toEqual([]);
  });

  it('fails (critical) on a verified live domain, warns on a live shop still on its preview URL', async () => {
    const noindex = ok('<meta name="robots" content="noindex">');
    const verified = setup({ [SITE]: noindex });
    expect(await runCheck(verified.checks['website.indexable'], live())).toMatchObject({ status: 'fail', severity: 'critical' });
    const preview = setup({ ['https://fade-room.example.co.uk']: noindex });
    expect((await runCheck(preview.checks['website.indexable'], healthyContext())).status).toBe('warn');
  });
});

describe('website.shows_shop', () => {
  it('warns when the site shows another shop or stale contact details', async () => {
    const { checks } = setup({ [SITE]: ok('<h1>Fade Room</h1><p>Call 0207 000 0000</p>'), [DATA]: ok(siteData()) });
    const r = await runCheck(checks['website.shows_shop'], live());
    expect(r).toMatchObject({ status: 'fail', severity: 'warning' });
    expect(r.message).toContain('phone number or postcode');
  });

  it('accepts the postcode without the phone', async () => {
    const { checks } = setup({ [SITE]: ok('<h1>Fade Room</h1><p>M1 1AA</p>'), [DATA]: ok(siteData()) });
    expect((await runCheck(checks['website.shows_shop'], live())).status).toBe('pass');
  });
});

describe('website.tls', () => {
  it('fails within 14 days of expiry, only for a verified own domain', async () => {
    const { checks } = setup({ [SITE]: ok(GOOD_SITE, { certValidTo: new Date('2026-11-10T00:00:00Z') }) });
    expect((await runCheck(checks['website.tls'], live())).message).toBe('The HTTPS certificate expires in 5 days.');
    expect((await runCheck(checks['website.tls'], healthyContext())).status).toBe('skip');
  });
});

describe('website.preview_up', () => {
  it('runs for drafts only; noindex is fine there', async () => {
    const url = 'https://fade-room.example.co.uk';
    const { checks } = setup({ [url]: ok('<meta name="robots" content="noindex">') });
    expect((await runCheck(checks['website.preview_up'], healthyContext({ mode: 'PRELAUNCH' }))).status).toBe('pass');
    expect((await runCheck(checks['website.preview_up'], healthyContext())).status).toBe('skip');
  });
});

describe('retail.page', () => {
  it('fails when no active product is listed', async () => {
    const { checks } = setup({ [SHOP]: ok('<p>No products</p>') });
    expect((await runCheck(checks['retail.page'], live())).status).toBe('fail');
  });
});

describe('payments.stripe_account', () => {
  const account = { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, disabledReason: null, currentlyDue: [] as string[] };

  it('fails when Stripe disabled the account, warns on outstanding requirements', async () => {
    let s = setup({}, vi.fn().mockResolvedValue({ ...account, chargesEnabled: false, disabledReason: 'requirements.past_due' }));
    expect((await runCheck(s.checks['payments.stripe_account'], live())).message).toBe(
      'Stripe has disabled payments on this account (requirements.past_due).',
    );
    clearStripeHealthCache();
    s = setup({}, vi.fn().mockResolvedValue({ ...account, currentlyDue: ['individual.verification.document'], payoutsEnabled: false }));
    expect((await runCheck(s.checks['payments.stripe_account'], live())).status).toBe('warn');
  });

  it('caches the account for an hour and is inconclusive when Stripe errors', async () => {
    const stripe = vi.fn().mockResolvedValue(account);
    const { checks } = setup({}, stripe);
    await runCheck(checks['payments.stripe_account'], live());
    await runCheck(checks['payments.stripe_account'], live());
    expect(stripe).toHaveBeenCalledTimes(1);
    clearStripeHealthCache();
    const failing = setup({}, vi.fn().mockRejectedValue(new Error('Stripe 500')));
    expect((await runCheck(failing.checks['payments.stripe_account'], live())).status).toBe('inconclusive');
  });

  it('does not apply without any payments', async () => {
    const ctx: ShopHealthContext = live({ shop: { retailEnabled: false } });
    expect((await runCheck(setup({}).checks['payments.stripe_account'], ctx)).status).toBe('skip');
  });
});
