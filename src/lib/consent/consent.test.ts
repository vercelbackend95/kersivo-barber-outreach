/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from './config';
import {
  clearOptionalStorageOnWithdraw,
  OPTIONAL_COOKIE_PREFIXES,
  OPTIONAL_LOCAL_STORAGE_KEYS,
  OPTIONAL_WEB_STORAGE_PREFIXES,
} from './cleanup';
import { preferencesToGoogleConsent } from './googleConsent';
import { applyConsentChoice } from './index';
import { createPreferences, parseConsentCookieValue, writeConsentPreferences } from './storage';

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
      { gaMeasurementId: '', googleAdsId: '' },
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
      { gaMeasurementId: '', googleAdsId: '' },
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
      { gaMeasurementId: '', googleAdsId: '' },
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
