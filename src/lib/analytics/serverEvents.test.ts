import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/consent/config';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from './serverEvents';

function consentCookie(analytics: boolean): string {
  const value = encodeURIComponent(
    JSON.stringify({
      version: CONSENT_VERSION,
      necessary: true,
      analytics,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
      timestamp: '2026-10-30T10:00:00.000Z',
    }),
  );
  return `${CONSENT_COOKIE_NAME}=${value}`;
}

function requestWith(cookie: string): Request {
  return new Request('https://kersivo.co.uk/x', { headers: { cookie } });
}

describe('analyticsClientIdFromRequest', () => {
  it('reads the client id with Analytics consent', () => {
    expect(analyticsClientIdFromRequest(requestWith(`${consentCookie(true)}; _ga=GA1.1.123.456`))).toBe('123.456');
  });

  it('returns null without consent, without a cookie, or for internal traffic', () => {
    expect(analyticsClientIdFromRequest(requestWith(`${consentCookie(false)}; _ga=GA1.1.123.456`))).toBeNull();
    expect(analyticsClientIdFromRequest(requestWith('_ga=GA1.1.123.456'))).toBeNull();
    expect(analyticsClientIdFromRequest(requestWith(consentCookie(true)))).toBeNull();
    expect(analyticsClientIdFromRequest(requestWith(`${consentCookie(true)}; _ga=junk`))).toBeNull();
    expect(
      analyticsClientIdFromRequest(requestWith(`${consentCookie(true)}; _ga=GA1.1.123.456; kersivo_internal=1`)),
    ).toBeNull();
  });
});

describe('sendServerAnalyticsEvent', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PUBLIC_GA4_MEASUREMENT_ID', 'G-TEST');
    vi.stubEnv('GA4_MEASUREMENT_PROTOCOL_API_SECRET', 'secret');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts the event to GA4 with the client id', async () => {
    expect(await sendServerAnalyticsEvent({ name: 'preview_converted', clientId: '123.456' })).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('measurement_id=G-TEST');
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: '123.456',
      events: [{ name: 'preview_converted', params: {} }],
    });
  });

  it('sends nothing without a client id or without the secret', async () => {
    expect(await sendServerAnalyticsEvent({ name: 'preview_converted', clientId: null })).toBe(false);
    vi.stubEnv('GA4_MEASUREMENT_PROTOCOL_API_SECRET', '');
    expect(await sendServerAnalyticsEvent({ name: 'preview_converted', clientId: '123.456' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when GA4 is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await sendServerAnalyticsEvent({ name: 'preview_viewed', clientId: '123.456' })).toBe(false);
  });
});
