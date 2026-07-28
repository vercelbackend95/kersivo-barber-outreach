import { describe, expect, it, vi } from 'vitest';
import {
  arePurchaseTagsReady,
  buildGoogleAdsPurchaseSendTo,
  fireSaasPurchaseTracking,
  normalizeGoogleAdsId,
  resolvePurchaseTrackingTargets,
  saasPurchaseDedupKeyAds,
  saasPurchaseDedupKeyGa4,
  shouldTrackSaasPurchase,
} from './adsConversion';

describe('normalizeGoogleAdsId', () => {
  it('accepts AW- prefix and bare digits', () => {
    expect(normalizeGoogleAdsId('AW-123456')).toBe('AW-123456');
    expect(normalizeGoogleAdsId('123456')).toBe('AW-123456');
  });

  it('returns null for empty or invalid', () => {
    expect(normalizeGoogleAdsId('')).toBeNull();
    expect(normalizeGoogleAdsId('  ')).toBeNull();
    expect(normalizeGoogleAdsId('G-XXXX')).toBeNull();
  });
});

describe('buildGoogleAdsPurchaseSendTo', () => {
  it('builds send_to from id + label', () => {
    expect(
      buildGoogleAdsPurchaseSendTo({
        googleAdsId: 'AW-999',
        purchaseConversionLabel: 'abcLabel',
      }),
    ).toBe('AW-999/abcLabel');
  });

  it('accepts full send_to pasted as label', () => {
    expect(
      buildGoogleAdsPurchaseSendTo({
        googleAdsId: 'AW-1',
        purchaseConversionLabel: 'AW-999/fullLabel',
      }),
    ).toBe('AW-999/fullLabel');
  });

  it('returns null without label or without ads id', () => {
    expect(
      buildGoogleAdsPurchaseSendTo({
        googleAdsId: 'AW-999',
        purchaseConversionLabel: '',
      }),
    ).toBeNull();
    expect(
      buildGoogleAdsPurchaseSendTo({
        googleAdsId: '',
        purchaseConversionLabel: 'abc',
      }),
    ).toBeNull();
  });
});

describe('shouldTrackSaasPurchase', () => {
  it('allows analytics or advertising measurement', () => {
    expect(shouldTrackSaasPurchase({ analytics: true, advertisingMeasurement: false })).toBe(true);
    expect(shouldTrackSaasPurchase({ analytics: false, advertisingMeasurement: true })).toBe(true);
    expect(shouldTrackSaasPurchase({ analytics: false, advertisingMeasurement: false })).toBe(false);
  });
});

describe('resolvePurchaseTrackingTargets / arePurchaseTagsReady', () => {
  it('wants GA4 for analytics and Ads conversion when ads + send_to', () => {
    expect(
      resolvePurchaseTrackingTargets({ analytics: true, advertisingMeasurement: true }, 'AW-1/x'),
    ).toEqual({ wantGa4: true, wantAdsConversion: true });
    expect(
      resolvePurchaseTrackingTargets({ analytics: true, advertisingMeasurement: false }, 'AW-1/x'),
    ).toEqual({ wantGa4: true, wantAdsConversion: false });
  });

  it('waits for the configured flags of wanted channels only', () => {
    expect(
      arePurchaseTagsReady(
        { wantGa4: true, wantAdsConversion: false },
        { ga4Configured: false, adsConfigured: false },
      ),
    ).toBe(false);
    expect(
      arePurchaseTagsReady(
        { wantGa4: true, wantAdsConversion: false },
        { ga4Configured: true, adsConfigured: false },
      ),
    ).toBe(true);
  });
});

describe('fireSaasPurchaseTracking (progressive)', () => {
  it('fires GA4 only when analytics consent', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: true, advertisingMeasurement: false },
      gtag,
    });
    expect(result).toMatchObject({
      firedGa4: true,
      firedAdsConversion: false,
      pendingGa4: false,
      pendingAds: false,
      complete: true,
    });
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'saas_subscription_paid',
      expect.objectContaining({ transaction_id: 'sub_1', value: 39, currency: 'GBP' }),
    );
  });

  it('fires Ads conversion when advertising consent + send_to', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: false, advertisingMeasurement: true },
      gtag,
    });
    expect(result).toMatchObject({
      firedGa4: false,
      firedAdsConversion: true,
      complete: true,
    });
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'conversion',
      expect.objectContaining({
        send_to: 'AW-1/label',
        transaction_id: 'sub_1',
        value: 39,
      }),
    );
  });

  it('fires both when both consents and send_to present', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: true, advertisingMeasurement: true },
      gtag,
    });
    expect(result).toMatchObject({
      firedGa4: true,
      firedAdsConversion: true,
      complete: true,
    });
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it('no-ops without consent', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: false, advertisingMeasurement: false },
      gtag,
    });
    expect(result.complete).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('fires GA4 when only GA4 is ready; keeps Ads pending', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: true, advertisingMeasurement: true },
      gtag,
      tagReady: { ga4Configured: true, adsConfigured: false },
    });
    expect(result).toMatchObject({
      firedGa4: true,
      firedAdsConversion: false,
      pendingGa4: false,
      pendingAds: true,
      complete: false,
    });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'saas_subscription_paid', expect.any(Object));
  });

  it('fires Ads on a later call when alreadyFired.ga4 and Ads becomes ready', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: true, advertisingMeasurement: true },
      gtag,
      tagReady: { ga4Configured: true, adsConfigured: true },
      alreadyFired: { ga4: true, ads: false },
    });
    expect(result).toMatchObject({
      firedGa4: false,
      firedAdsConversion: true,
      complete: true,
    });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', expect.any(Object));
  });

  it('completes GA4-only when Ads abandoned', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: true, advertisingMeasurement: true },
      gtag,
      tagReady: { ga4Configured: true, adsConfigured: false },
      abandonAds: true,
    });
    expect(result).toMatchObject({
      firedGa4: true,
      firedAdsConversion: false,
      pendingAds: false,
      complete: true,
    });
  });

  it('skips channels already fired (per-channel dedup)', () => {
    const gtag = vi.fn();
    const result = fireSaasPurchaseTracking({
      transactionId: 'sub_1',
      value: 39,
      adsSendTo: 'AW-1/label',
      consent: { analytics: true, advertisingMeasurement: true },
      gtag,
      alreadyFired: { ga4: true, ads: true },
    });
    expect(result.complete).toBe(true);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('exposes stable per-channel dedup keys', () => {
    expect(saasPurchaseDedupKeyGa4('sub_1')).toBe('saas_subscription_paid:ga4:sub_1');
    expect(saasPurchaseDedupKeyAds('sub_1')).toBe('saas_subscription_paid:ads:sub_1');
  });
});
