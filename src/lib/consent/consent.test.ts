import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from './config';
import { preferencesToGoogleConsent } from './googleConsent';
import { OPTIONAL_COOKIE_PREFIXES } from './cleanup';
import { createPreferences, parseConsentCookieValue } from './storage';

describe('consent preferences', () => {
  it('creates versioned preferences with personalisedAdvertising always false', () => {
    const prefs = createPreferences({ analytics: true, advertisingMeasurement: true });
    expect(prefs.version).toBe(CONSENT_VERSION);
    expect(prefs.necessary).toBe(true);
    expect(prefs.analytics).toBe(true);
    expect(prefs.advertisingMeasurement).toBe(true);
    expect(prefs.personalisedAdvertising).toBe(false);
    expect(prefs.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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
          personalisedAdvertising: true,
          timestamp: new Date().toISOString(),
        }),
      ),
    ).toBeNull();
  });

  it('parses a valid consent record', () => {
    const raw = JSON.stringify(
      createPreferences({ analytics: false, advertisingMeasurement: true }),
    );
    const parsed = parseConsentCookieValue(raw);
    expect(parsed?.analytics).toBe(false);
    expect(parsed?.advertisingMeasurement).toBe(true);
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
    const prefs = createPreferences({ analytics: true, advertisingMeasurement: false });
    expect(preferencesToGoogleConsent(prefs)).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('grants ad_storage and ad_user_data together for advertising measurement', () => {
    const prefs = createPreferences({ analytics: false, advertisingMeasurement: true });
    expect(preferencesToGoogleConsent(prefs)).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'denied',
    });
  });

  it('never grants ad_personalization', () => {
    const prefs = createPreferences({ analytics: true, advertisingMeasurement: true });
    expect(preferencesToGoogleConsent(prefs).ad_personalization).toBe('denied');
  });
});

describe('optional cookie prefixes', () => {
  it('includes Google analytics and ads first-party prefixes', () => {
    expect(OPTIONAL_COOKIE_PREFIXES).toContain('_ga');
    expect(OPTIONAL_COOKIE_PREFIXES).toContain('_gid');
    expect(OPTIONAL_COOKIE_PREFIXES).toContain('_gcl');
  });
});
