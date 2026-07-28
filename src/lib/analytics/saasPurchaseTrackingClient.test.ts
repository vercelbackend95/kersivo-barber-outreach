/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { saasPurchaseDedupKeyGa4 } from './adsConversion';
import { startSaasPurchaseTracking } from './saasPurchaseTrackingClient';
import { CONSENT_CHANGED_EVENT, CONSENT_VERSION } from '@/lib/consent/config';

describe('startSaasPurchaseTracking', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    Object.defineProperty(window, 'sessionStorage', {
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
    window.__kersivoGa4Configured = undefined;
    window.__kersivoAdsConfigured = undefined;
    window.gtag = vi.fn();
    // Clear cookies
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

  it('fires GA4 after late consent and records per-channel dedup', () => {
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
    expect(store[saasPurchaseDedupKeyGa4('sub_late')]).toBe('1');

    handle.stop();
  });

  it('does not re-fire GA4 when dedup key already set', () => {
    setConsentCookie(true, false);
    window.__kersivoGa4Configured = true;
    store[saasPurchaseDedupKeyGa4('sub_dup')] = '1';

    const handle = startSaasPurchaseTracking({
      transactionId: 'sub_dup',
      value: 39,
      adsSendTo: null,
    });

    expect(window.gtag).not.toHaveBeenCalled();
    handle.stop();
  });
});
