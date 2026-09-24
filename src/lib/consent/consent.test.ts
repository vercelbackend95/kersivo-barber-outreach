/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptAllChoiceForAdsCapability,
  BANNER_COPY,
  CONSENT_COOKIE_NAME,
  CONSENT_VERSION,
  isGoogleAdsCapabilityEnabled,
  normalizeConsentChoiceForAdsCapability,
  resolveBannerBody,
  toEffectiveConsentPreferences,
} from './config';
import {
  clearOptionalStorageOnWithdraw,
  OPTIONAL_COOKIE_PREFIXES,
  OPTIONAL_LOCAL_STORAGE_KEYS,
  OPTIONAL_WEB_STORAGE_PREFIXES,
} from './cleanup';
import { preferencesToGoogleConsent } from './googleConsent';
import { applyConsentChoice, bootConsentRuntime } from './index';
import { resolveTagTargets, syncTagsForConsent } from './tagLoader';
import { createPreferences, parseConsentCookieValue, readConsentPreferences, writeConsentPreferences } from './storage';

vi.mock('./tagLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tagLoader')>();
  return {
    ...actual,
    syncTagsForConsent: vi.fn(async () => undefined),
  };
});

const NONE = {
  analytics: false,
  advertisingMeasurement: false,
  personalisedAdvertising: false,
} as const;

const ACCEPT_ALL = {
  analytics: true,
  advertisingMeasurement: true,
  personalisedAdvertising: true,
} as const;

function seedDocumentCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/`;
}

function documentCookieNames(): string[] {
  return document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean);
}

function clearAllCookies(): void {
  document.cookie.split(';').forEach((part) => {
    const name = part.trim().split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  });
}

function seedFullOptionalResidue(): void {
  seedDocumentCookie('_ga', 'GA1.1.1');
  seedDocumentCookie('_ga_ABC', 'GS1.1');
  seedDocumentCookie('_gid', 'GA1.2.2');
  seedDocumentCookie('_gcl_au', '1.1.1');
  seedDocumentCookie('_gac_AW', '1.1');
  localStorage.setItem('_gcl_ls', 'ads-linker');
  localStorage.setItem('saas_subscription_paid:ga4:tx1', '1');
  localStorage.setItem('saas_subscription_paid:ads:tx1', '1');
  localStorage.setItem('saas_subscription_paid:legacy', '1');
  localStorage.setItem('setup_deposit_paid:old', '1');
  sessionStorage.setItem('saas_subscription_paid:ga4:tx1', '1');
  sessionStorage.setItem('saas_subscription_paid:ads:tx1', '1');
  sessionStorage.setItem('saas_subscription_paid:legacy', '1');
  sessionStorage.setItem('setup_deposit_paid:old', '1');
  localStorage.setItem('cart:items', 'keep-cart');
  localStorage.setItem('kersivo_shop_cart_v2', 'keep-shop-cart');
  sessionStorage.setItem('feature261-reports-widget-v2', 'keep-session');
}

describe('consent preferences', () => {
  it('creates versioned preferences from the three optional purposes', () => {
    const prefs = createPreferences(ACCEPT_ALL);
    expect(prefs.version).toBe(CONSENT_VERSION);
    expect(prefs.necessary).toBe(true);
    expect(prefs.analytics).toBe(true);
    expect(prefs.advertisingMeasurement).toBe(true);
    expect(prefs.personalisedAdvertising).toBe(true);
    expect(prefs.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults personalised advertising to false when not granted', () => {
    expect(createPreferences({ ...NONE, analytics: true }).personalisedAdvertising).toBe(false);
  });

  it('rejects outdated or invalid cookie payloads', () => {
    expect(parseConsentCookieValue(null)).toBeNull();
    expect(
      parseConsentCookieValue(
        JSON.stringify({
          version: CONSENT_VERSION - 1,
          necessary: true,
          analytics: true,
          advertisingMeasurement: false,
          personalisedAdvertising: false,
          timestamp: new Date().toISOString(),
        }),
      ),
    ).toBeNull();
    expect(
      parseConsentCookieValue(
        JSON.stringify({
          version: CONSENT_VERSION,
          necessary: true,
          analytics: true,
          advertisingMeasurement: false,
          timestamp: new Date().toISOString(),
        }),
      ),
    ).toBeNull();
  });

  it('parses a valid consent record including personalised advertising', () => {
    const raw = JSON.stringify(
      createPreferences({
        analytics: false,
        advertisingMeasurement: true,
        personalisedAdvertising: true,
      }),
    );
    const parsed = parseConsentCookieValue(raw);
    expect(parsed?.analytics).toBe(false);
    expect(parsed?.advertisingMeasurement).toBe(true);
    expect(parsed?.personalisedAdvertising).toBe(true);
  });
});

describe('Google consent mapping', () => {
  it('defaults all optional states to denied when prefs are null', () => {
    expect(preferencesToGoogleConsent(null)).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('grants analytics only when analytics is true', () => {
    const prefs = createPreferences({ ...NONE, analytics: true });
    expect(preferencesToGoogleConsent(prefs)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('grants ad_storage and ad_user_data without personalisation for measurement only', () => {
    const prefs = createPreferences({ ...NONE, advertisingMeasurement: true });
    expect(preferencesToGoogleConsent(prefs)).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'denied',
    });
  });

  it('grants ad_personalization plus ad storage for personalised advertising alone', () => {
    const prefs = createPreferences({ ...NONE, personalisedAdvertising: true });
    expect(preferencesToGoogleConsent(prefs)).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  });

  it('grants every purpose on accept all', () => {
    const prefs = createPreferences(ACCEPT_ALL);
    expect(preferencesToGoogleConsent(prefs)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  });
});

describe('optional cookie prefixes', () => {
  it('includes Google analytics and ads first-party prefixes', () => {
    expect(OPTIONAL_COOKIE_PREFIXES).toContain('_ga');
    expect(OPTIONAL_COOKIE_PREFIXES).toContain('_gid');
    expect(OPTIONAL_COOKIE_PREFIXES).toContain('_gcl');
    expect(OPTIONAL_COOKIE_PREFIXES).toContain('_gac');
  });

  it('allowlists web-storage cleanup prefixes and _gcl_ls', () => {
    expect(OPTIONAL_WEB_STORAGE_PREFIXES).toContain('saas_subscription_paid:');
    expect(OPTIONAL_WEB_STORAGE_PREFIXES).toContain('setup_deposit_paid:');
    expect(OPTIONAL_LOCAL_STORAGE_KEYS).toContain('_gcl_ls');
  });
});

describe('full optional storage wipe helper', () => {
  beforeEach(() => {
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes all allowlisted optional residue while protecting necessary keys', () => {
    seedFullOptionalResidue();
    seedDocumentCookie(CONSENT_COOKIE_NAME, JSON.stringify(createPreferences(NONE)));
    seedDocumentCookie('kersivo_admin_session', 'keep-me');

    clearOptionalStorageOnWithdraw();

    const cookieNames = documentCookieNames();
    expect(cookieNames).not.toContain('_ga');
    expect(cookieNames).not.toContain('_ga_ABC');
    expect(cookieNames).not.toContain('_gid');
    expect(cookieNames).not.toContain('_gcl_au');
    expect(cookieNames).not.toContain('_gac_AW');
    expect(cookieNames).toContain(CONSENT_COOKIE_NAME);
    expect(cookieNames).toContain('kersivo_admin_session');

    expect(localStorage.getItem('_gcl_ls')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:legacy')).toBeNull();
    expect(localStorage.getItem('setup_deposit_paid:old')).toBeNull();
    expect(localStorage.getItem('cart:items')).toBe('keep-cart');
    expect(localStorage.getItem('kersivo_shop_cart_v2')).toBe('keep-shop-cart');
    expect(sessionStorage.getItem('feature261-reports-widget-v2')).toBe('keep-session');
  });
});

describe('category-aware applyConsentChoice cleanup', () => {
  beforeEach(() => {
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('1. Accept all → Analytics only: keeps GA, clears Ads + Ads dedup', async () => {
    writeConsentPreferences(createPreferences(ACCEPT_ALL));
    seedFullOptionalResidue();

    await applyConsentChoice(
      { ...NONE, analytics: true },
      { gaMeasurementId: '', googleAdsId: '' },
    );

    const cookies = documentCookieNames();
    expect(cookies).toContain('_ga');
    expect(cookies).toContain('_ga_ABC');
    expect(cookies).toContain('_gid');
    expect(cookies).not.toContain('_gcl_au');
    expect(cookies).not.toContain('_gac_AW');
    expect(localStorage.getItem('_gcl_ls')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBe('1');
    expect(sessionStorage.getItem('saas_subscription_paid:ga4:tx1')).toBe('1');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(sessionStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:legacy')).toBeNull();
    expect(localStorage.getItem('setup_deposit_paid:old')).toBeNull();
    expect(localStorage.getItem('cart:items')).toBe('keep-cart');
  });

  it('2. Accept all → Ads measurement only: keeps Ads, clears GA + GA dedup', async () => {
    writeConsentPreferences(createPreferences(ACCEPT_ALL));
    seedFullOptionalResidue();

    await applyConsentChoice(
      { ...NONE, advertisingMeasurement: true },
      { gaMeasurementId: 'G-TEST', googleAdsId: 'AW-TEST' },
    );

    const cookies = documentCookieNames();
    expect(cookies).not.toContain('_ga');
    expect(cookies).not.toContain('_ga_ABC');
    expect(cookies).not.toContain('_gid');
    expect(cookies).toContain('_gcl_au');
    expect(cookies).toContain('_gac_AW');
    expect(localStorage.getItem('_gcl_ls')).toBe('ads-linker');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBe('1');
    expect(sessionStorage.getItem('saas_subscription_paid:ads:tx1')).toBe('1');
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(sessionStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:legacy')).toBeNull();
    expect(localStorage.getItem('setup_deposit_paid:old')).toBeNull();
  });

  it('3. Accept all → Personalised only: keeps Ads browser, clears GA + Ads conversion dedup', async () => {
    writeConsentPreferences(createPreferences(ACCEPT_ALL));
    seedFullOptionalResidue();

    await applyConsentChoice(
      { ...NONE, personalisedAdvertising: true },
      { gaMeasurementId: 'G-TEST', googleAdsId: 'AW-TEST' },
    );

    const cookies = documentCookieNames();
    expect(cookies).not.toContain('_ga');
    expect(cookies).not.toContain('_gid');
    expect(cookies).toContain('_gcl_au');
    expect(cookies).toContain('_gac_AW');
    expect(localStorage.getItem('_gcl_ls')).toBe('ads-linker');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(sessionStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(localStorage.getItem('setup_deposit_paid:old')).toBeNull();
  });

  it('4. Analytics only → save Analytics only again: does not clear GA storage', async () => {
    writeConsentPreferences(createPreferences({ ...NONE, analytics: true }));
    seedDocumentCookie('_ga', 'GA1.1.keep');
    seedDocumentCookie('_ga_ABC', 'GS1.keep');
    localStorage.setItem('saas_subscription_paid:ga4:tx1', '1');
    localStorage.setItem('cart:items', 'keep-cart');

    await applyConsentChoice(
      { ...NONE, analytics: true },
      { gaMeasurementId: '', googleAdsId: '' },
    );

    expect(documentCookieNames()).toContain('_ga');
    expect(documentCookieNames()).toContain('_ga_ABC');
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBe('1');
    expect(localStorage.getItem('cart:items')).toBe('keep-cart');
  });

  it('5. Ads measurement only → save again: does not clear Ads browser storage', async () => {
    writeConsentPreferences(createPreferences({ ...NONE, advertisingMeasurement: true }));
    seedDocumentCookie('_gcl_au', '1.1.keep');
    localStorage.setItem('_gcl_ls', 'keep-linker');
    localStorage.setItem('saas_subscription_paid:ads:tx1', '1');

    await applyConsentChoice(
      { ...NONE, advertisingMeasurement: true },
      { gaMeasurementId: 'G-TEST', googleAdsId: 'AW-TEST' },
    );

    expect(documentCookieNames()).toContain('_gcl_au');
    expect(localStorage.getItem('_gcl_ls')).toBe('keep-linker');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBe('1');
  });

  it('6. Reject all clears all allowlisted optional storage', async () => {
    writeConsentPreferences(createPreferences(ACCEPT_ALL));
    seedFullOptionalResidue();

    await applyConsentChoice(NONE, { gaMeasurementId: '', googleAdsId: '' });

    const cookies = documentCookieNames();
    expect(cookies).not.toContain('_ga');
    expect(cookies).not.toContain('_gcl_au');
    expect(localStorage.getItem('_gcl_ls')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:legacy')).toBeNull();
    expect(localStorage.getItem('setup_deposit_paid:old')).toBeNull();
    expect(localStorage.getItem('cart:items')).toBe('keep-cart');
    expect(sessionStorage.getItem('feature261-reports-widget-v2')).toBe('keep-session');
    expect(cookies).toContain(CONSENT_COOKIE_NAME);
  });

  it('7. previous invalid/old → Accept all still clears stale allowlisted residue first', async () => {
    seedFullOptionalResidue();
    const outdated = {
      version: CONSENT_VERSION - 1,
      necessary: true,
      analytics: true,
      advertisingMeasurement: true,
      personalisedAdvertising: true,
      timestamp: new Date().toISOString(),
    };
    seedDocumentCookie(CONSENT_COOKIE_NAME, JSON.stringify(outdated));
    expect(parseConsentCookieValue(JSON.stringify(outdated))).toBeNull();

    await applyConsentChoice(ACCEPT_ALL, { gaMeasurementId: '', googleAdsId: '' });

    const cookies = documentCookieNames();
    expect(cookies).not.toContain('_ga');
    expect(cookies).not.toContain('_gcl_au');
    expect(localStorage.getItem('_gcl_ls')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(localStorage.getItem('cart:items')).toBe('keep-cart');
    expect(cookies).toContain(CONSENT_COOKIE_NAME);
  });

  it('8. previous missing → Analytics only clears stale residue then records analytics consent', async () => {
    seedFullOptionalResidue();

    const prefs = await applyConsentChoice(
      { ...NONE, analytics: true },
      { gaMeasurementId: '', googleAdsId: '' },
    );

    expect(prefs.analytics).toBe(true);
    expect(documentCookieNames()).not.toContain('_ga');
    expect(documentCookieNames()).not.toContain('_gcl_au');
    expect(localStorage.getItem('_gcl_ls')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(localStorage.getItem('cart:items')).toBe('keep-cart');
  });

  it('9. necessary cart / consent / unrelated storage survive reject', async () => {
    writeConsentPreferences(createPreferences(ACCEPT_ALL));
    seedFullOptionalResidue();
    seedDocumentCookie('kersivo_admin_session', 'keep-me');

    await applyConsentChoice(NONE, { gaMeasurementId: '', googleAdsId: '' });

    expect(documentCookieNames()).toContain(CONSENT_COOKIE_NAME);
    expect(documentCookieNames()).toContain('kersivo_admin_session');
    expect(localStorage.getItem('cart:items')).toBe('keep-cart');
    expect(localStorage.getItem('kersivo_shop_cart_v2')).toBe('keep-shop-cart');
    expect(sessionStorage.getItem('feature261-reports-widget-v2')).toBe('keep-session');
  });
});

describe('Ads capability / dormant helpers', () => {
  it('detects Ads capability from a non-empty Google Ads ID', () => {
    expect(isGoogleAdsCapabilityEnabled('AW-1')).toBe(true);
    expect(isGoogleAdsCapabilityEnabled('  ')).toBe(false);
    expect(isGoogleAdsCapabilityEnabled('')).toBe(false);
    expect(isGoogleAdsCapabilityEnabled(null)).toBe(false);
  });

  it('uses analytics-only banner copy without Ads / advertising / remarketing wording', () => {
    const body = resolveBannerBody(false);
    expect(body).toBe(BANNER_COPY.bodyAnalyticsOnly);
    expect(body.toLowerCase()).not.toContain('google ads');
    expect(body.toLowerCase()).not.toContain('advertising cookies');
    expect(body.toLowerCase()).not.toContain('remarketing');
    expect(resolveBannerBody(true)).toBe(BANNER_COPY.bodyAdsConfigured);
    expect(resolveBannerBody(true).toLowerCase()).toContain('google ads');
  });

  it('Accept all with Ads absent grants analytics only', () => {
    expect(acceptAllChoiceForAdsCapability(false)).toEqual({
      analytics: true,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
    });
    expect(acceptAllChoiceForAdsCapability(true)).toEqual(ACCEPT_ALL);
  });

  it('normalizer cannot persist Ads grants when Ads capability is absent', () => {
    expect(
      normalizeConsentChoiceForAdsCapability(
        {
          analytics: true,
          advertisingMeasurement: true,
          personalisedAdvertising: true,
        },
        false,
      ),
    ).toEqual({
      analytics: true,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
    });
  });
});

describe('Ads-absent applyConsentChoice clamping', () => {
  beforeEach(() => {
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('Accept all with empty Ads ID forces Ads purposes false', async () => {
    const prefs = await applyConsentChoice(ACCEPT_ALL, {
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    expect(prefs.version).toBe(CONSENT_VERSION);
    expect(prefs.analytics).toBe(true);
    expect(prefs.advertisingMeasurement).toBe(false);
    expect(prefs.personalisedAdvertising).toBe(false);
    expect(preferencesToGoogleConsent(prefs)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(
      resolveTagTargets(prefs, { gaMeasurementId: 'G-TEST', googleAdsId: '' }),
    ).toEqual({ wantAnalytics: true, wantAds: false });
  });

  it('Reject optional with Ads absent keeps all optional false', async () => {
    const prefs = await applyConsentChoice(NONE, {
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    expect(prefs).toMatchObject(NONE);
  });

  it('v2 consent with Ads=true is invalid under CONSENT_VERSION 3', () => {
    expect(CONSENT_VERSION).toBe(3);
    const v2 = {
      version: 2,
      necessary: true as const,
      analytics: true,
      advertisingMeasurement: true,
      personalisedAdvertising: true,
      timestamp: new Date().toISOString(),
    };
    expect(parseConsentCookieValue(JSON.stringify(v2))).toBeNull();
  });

  it('invalidated v2 Ads grant + Accept all Ads-absent clears stale Ads storage', async () => {
    seedFullOptionalResidue();
    seedDocumentCookie(
      CONSENT_COOKIE_NAME,
      JSON.stringify({
        version: 2,
        necessary: true,
        analytics: true,
        advertisingMeasurement: true,
        personalisedAdvertising: true,
        timestamp: new Date().toISOString(),
      }),
    );

    const prefs = await applyConsentChoice(ACCEPT_ALL, {
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });

    expect(prefs.advertisingMeasurement).toBe(false);
    expect(localStorage.getItem('_gcl_ls')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(documentCookieNames()).not.toContain('_gcl_au');
  });

  it('Ads configured Accept all still grants all three optional purposes', async () => {
    const prefs = await applyConsentChoice(ACCEPT_ALL, {
      gaMeasurementId: 'G-TEST',
      googleAdsId: 'AW-TEST',
    });
    expect(prefs).toMatchObject(ACCEPT_ALL);
    expect(
      resolveTagTargets(prefs, { gaMeasurementId: 'G-TEST', googleAdsId: 'AW-TEST' }),
    ).toEqual({ wantAnalytics: true, wantAds: true });
  });
});

describe('stored vs effective Ads consent (bootstrap / bootConsentRuntime)', () => {
  beforeEach(() => {
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.__kersivoConsentDefaultsApplied = false;
    window.dataLayer = [];
    window.gtag = vi.fn((...args: unknown[]) => {
      window.dataLayer!.push(args);
    }) as typeof window.gtag;
  });

  it('CASE A: stored Ads=true + Ads ID absent => GA granted, Ads Consent Mode denied, no Ads target', () => {
    const stored = createPreferences(ACCEPT_ALL);
    const effective = toEffectiveConsentPreferences(stored, '');
    expect(stored.advertisingMeasurement).toBe(true);
    expect(effective.advertisingMeasurement).toBe(false);
    expect(effective.personalisedAdvertising).toBe(false);
    expect(effective.analytics).toBe(true);
    expect(preferencesToGoogleConsent(effective)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(
      resolveTagTargets(effective, { gaMeasurementId: 'G-TEST', googleAdsId: '' }),
    ).toEqual({ wantAnalytics: true, wantAds: false });
  });

  it('CASE B: analytics=false + stored Ads=true + Ads ID absent => all denied, no tag targets', () => {
    const stored = createPreferences({
      analytics: false,
      advertisingMeasurement: true,
      personalisedAdvertising: true,
    });
    const effective = toEffectiveConsentPreferences(stored, '');
    expect(preferencesToGoogleConsent(effective)).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(
      resolveTagTargets(effective, { gaMeasurementId: 'G-TEST', googleAdsId: '' }),
    ).toEqual({ wantAnalytics: false, wantAds: false });
  });

  it('CASE C: analytics-only cookie + Ads ID absent => normal GA4 analytics-only', () => {
    const stored = createPreferences({
      analytics: true,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
    });
    const effective = toEffectiveConsentPreferences(stored, '');
    expect(effective).toEqual(stored);
    expect(preferencesToGoogleConsent(effective)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(
      resolveTagTargets(effective, { gaMeasurementId: 'G-TEST', googleAdsId: '' }),
    ).toEqual({ wantAnalytics: true, wantAds: false });
  });

  it('CASE D: Ads ID present preserves stored Ads grants (Ads-capable regression)', () => {
    const stored = createPreferences(ACCEPT_ALL);
    const effective = toEffectiveConsentPreferences(stored, 'AW-TEST');
    expect(effective).toEqual(stored);
    expect(preferencesToGoogleConsent(effective)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    expect(
      resolveTagTargets(effective, { gaMeasurementId: 'G-TEST', googleAdsId: 'AW-TEST' }),
    ).toEqual({ wantAnalytics: true, wantAds: true });
  });

  it('CASE E: bootConsentRuntime with Ads absent + stored Ads=true updates Google with effective Ads=false', () => {
    const stored = createPreferences(ACCEPT_ALL);
    writeConsentPreferences(stored);
    expect(readConsentPreferences()).toMatchObject(ACCEPT_ALL);

    const returned = bootConsentRuntime({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });

    expect(returned).toMatchObject(ACCEPT_ALL);
    expect(syncTagsForConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        analytics: true,
        advertisingMeasurement: false,
        personalisedAdvertising: false,
      }),
      { gaMeasurementId: 'G-TEST', googleAdsId: '' },
    );

    const updateCalls = (window.gtag as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 'consent' && call[1] === 'update',
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    expect(updateCalls[updateCalls.length - 1][2]).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });

    // Stored cookie must remain unchanged (no needless rewrite on boot).
    expect(readConsentPreferences()).toMatchObject(ACCEPT_ALL);
  });
});
