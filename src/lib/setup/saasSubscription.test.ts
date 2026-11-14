import { describe, expect, it, vi } from 'vitest';
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/consent/config';
import { analyticsIdsForCheckout, buildSaasSubscriptionStripeMetadata } from './saasSubscription';

describe('buildSaasSubscriptionStripeMetadata', () => {
  it('includes checkoutAttemptId and omits direct PII and campaign attribution', () => {
    const metadata = buildSaasSubscriptionStripeMetadata({
      checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440000',
      shopId: 'shop-1',
    });

    expect(metadata).toMatchObject({
      type: 'saas_subscription',
      checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440000',
      shopId: 'shop-1',
    });
    expect(metadata).not.toHaveProperty('customerName');
    expect(metadata).not.toHaveProperty('email');
    expect(metadata).not.toHaveProperty('shopName');
    expect(metadata).not.toHaveProperty('shopSize');
    expect(metadata).not.toHaveProperty('currentStack');
    expect(metadata).not.toHaveProperty('townCity');
    expect(metadata).not.toHaveProperty('barbers');
    expect(metadata).not.toHaveProperty('monthly_amount');
    for (const key of [
      'gclid',
      'gbraid',
      'wbraid',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'ga_client_id',
    ]) {
      expect(metadata).not.toHaveProperty(key);
    }
  });
});

describe('GA ids in SaaS checkout metadata', () => {
  const consent = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify({
      version: CONSENT_VERSION,
      necessary: true,
      analytics: true,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
      timestamp: '2026-11-14T10:00:00.000Z',
    }),
  )}`;
  const request = (cookie: string) => new Request('https://kersivo.co.uk/api/setup/x', { headers: { cookie } });

  it('stores the client and session id so the webhook can send saas_subscription_paid', () => {
    vi.stubEnv('PUBLIC_GA4_MEASUREMENT_ID', 'G-ABC123');
    const ids = analyticsIdsForCheckout(
      request(`${consent}; _ga=GA1.1.111.222; _ga_ABC123=GS2.1.s1731600000$o1$g1$t1731600100$j0$l0$h0`),
    );
    vi.unstubAllEnvs();
    expect(ids).toEqual({ gaClientId: '111.222', gaSessionId: '1731600000' });
    expect(
      buildSaasSubscriptionStripeMetadata({ checkoutAttemptId: 'a', ...ids }),
    ).toMatchObject({ gaClientId: '111.222', gaSessionId: '1731600000' });
  });

  it('stores nothing without consent or from an internal device', () => {
    expect(analyticsIdsForCheckout(request('_ga=GA1.1.111.222'))).toEqual({ gaClientId: null, gaSessionId: null });
    expect(analyticsIdsForCheckout(request(`${consent}; _ga=GA1.1.111.222; kersivo_internal=1`))).toEqual({
      gaClientId: null,
      gaSessionId: null,
    });
    const metadata = buildSaasSubscriptionStripeMetadata({ checkoutAttemptId: 'a', gaClientId: null, gaSessionId: '1' });
    expect(metadata).not.toHaveProperty('gaClientId');
    expect(metadata).not.toHaveProperty('gaSessionId');
  });
});
