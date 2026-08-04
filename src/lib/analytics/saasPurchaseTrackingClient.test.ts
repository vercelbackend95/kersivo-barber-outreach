/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { saasPurchaseDedupKeyAds, saasPurchaseDedupKeyGa4 } from './adsConversion';
import {
  SAAS_PURCHASE_ADS_ABANDON_AFTER_ATTEMPTS,
  SAAS_PURCHASE_POLL_MS,
  startSaasPurchaseTracking,
} from './saasPurchaseTrackingClient';
import { CONSENT_CHANGED_EVENT, CONSENT_VERSION } from '@/lib/consent/config';

describe('startSaasPurchaseTracking', () => {
  const sessionStore: Record<string, string> = {};
  const localStore: Record<string, string> = {};

  function installStorage(
    target: 'sessionStorage' | 'localStorage',
    store: Record<string, string>,
  ) {
    Object.defineProperty(window, target, {
      configurable: true,
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });
  }

  beforeEach(() => {
    for (const key of Object.keys(sessionStore)) delete sessionStore[key];
    for (const key of Object.keys(localStore)) delete localStore[key];
    installStorage('sessionStorage', sessionStore);
    installStorage('localStorage', localStore);
    window.__kersivoGa4Configured = undefined;
    window.__kersivoAdsConfigured = undefined;
    window.gtag = vi.fn();
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
    });
  });

  afterEach(() => {
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
    });
  });

  function setConsentCookie(analytics: boolean, advertisingMeasurement: boolean) {
    const prefs = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics,
      advertisingMeasurement,
      personalisedAdvertising: false,
      timestamp: new Date().toISOString(),
    };
    document.cookie = `kersivo_consent=${encodeURIComponent(JSON.stringify(prefs))}; Path=/`;
  }

  it('exposes ~20s default Ads abandon budget', () => {
    expect(SAAS_PURCHASE_POLL_MS).toBe(250);
    expect(SAAS_PURCHASE_ADS_ABANDON_AFTER_ATTEMPTS).toBe(80);
    expect(SAAS_PURCHASE_POLL_MS * SAAS_PURCHASE_ADS_ABANDON_AFTER_ATTEMPTS).toBe(20_000);
  });

  it('fires GA4 after late consent and records per-channel dedup in both storages', () => {
    const handle = startSaasPurchaseTracking({
      transactionId: 'sub_late',
      value: 39,
      adsSendTo: null,
      pollMs: 250,
    });

    expect(window.gtag).not.toHaveBeenCalled();

    setConsentCookie(true, false);
    window.__kersivoGa4Configured = true;
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));

    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'saas_subscription_paid',
      expect.objectContaining({ transaction_id: 'sub_late' }),
    );
    const key = saasPurchaseDedupKeyGa4('sub_late');
    expect(sessionStore[key]).toBe('1');
    expect(localStore[key]).toBe('1');

    handle.stop();
  });

  it('does not re-fire GA4 when dedup key already set in sessionStorage', () => {
    setConsentCookie(true, false);
    window.__kersivoGa4Configured = true;
    sessionStore[saasPurchaseDedupKeyGa4('sub_dup')] = '1';

    const handle = startSaasPurchaseTracking({
      transactionId: 'sub_dup',
      value: 39,
      adsSendTo: null,
    });

    expect(window.gtag).not.toHaveBeenCalled();
    handle.stop();
  });

  it('does not re-fire GA4 when dedup key exists only in localStorage (multi-tab)', () => {
    setConsentCookie(true, false);
    window.__kersivoGa4Configured = true;
    localStore[saasPurchaseDedupKeyGa4('sub_tab')] = '1';

    const handle = startSaasPurchaseTracking({
      transactionId: 'sub_tab',
      value: 39,
      adsSendTo: null,
    });

    expect(window.gtag).not.toHaveBeenCalled();
    handle.stop();
  });

  it('abandons Ads after configured attempts and still fires GA4', async () => {
    vi.useFakeTimers();
    setConsentCookie(true, true);
    window.__kersivoGa4Configured = true;
    window.__kersivoAdsConfigured = false;

    const handle = startSaasPurchaseTracking({
      transactionId: 'sub_abandon',
      value: 39,
      adsSendTo: 'AW-1/label',
      pollMs: 50,
      adsAbandonAfterAttempts: 3,
    });

    // First tick runs synchronously: attempt 1, GA4 fires, Ads still pending.
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'saas_subscription_paid',
      expect.objectContaining({ transaction_id: 'sub_abandon' }),
    );
    expect(window.gtag).not.toHaveBeenCalledWith('event', 'conversion', expect.anything());

    // Attempts 2, 3, 4 (>3) → abandon Ads, complete.
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(50);

    expect(window.gtag).not.toHaveBeenCalledWith('event', 'conversion', expect.anything());
    expect(sessionStore[saasPurchaseDedupKeyGa4('sub_abandon')]).toBe('1');
    expect(sessionStore[saasPurchaseDedupKeyAds('sub_abandon')]).toBeUndefined();

    handle.stop();
    vi.useRealTimers();
  });
});
