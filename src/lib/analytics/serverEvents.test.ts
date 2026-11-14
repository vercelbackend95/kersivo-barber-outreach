import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/consent/config';
import {
  analyticsClientIdFromCookieHeader,
  analyticsClientIdFromRequest,
  analyticsSessionIdFromCookieHeader,
  isMarketingServerEvent,
  sendServerAnalyticsEvent,
} from './serverEvents';

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

describe('analyticsClientIdFromCookieHeader', () => {
  it('matches the request variant and is null for an empty header', () => {
    expect(analyticsClientIdFromCookieHeader(`${consentCookie(true)}; _ga=GA1.1.123.456`)).toBe('123.456');
    expect(analyticsClientIdFromCookieHeader(null)).toBeNull();
    expect(analyticsClientIdFromCookieHeader(`${consentCookie(true)}; _ga=GA1.1.123.456; kersivo_internal=1`)).toBeNull();
  });
});

describe('analyticsSessionIdFromCookieHeader', () => {
  it('reads the session id from GS1 and GS2 stream cookies', () => {
    expect(analyticsSessionIdFromCookieHeader('_ga_ABC123=GS1.1.1731600000.4.1.1731600100.0.0.0', 'G-ABC123')).toBe(
      '1731600000',
    );
    expect(
      analyticsSessionIdFromCookieHeader('_ga_ABC123=GS2.1.s1731600000$o4$g1$t1731600100$j0$l0$h0', 'G-ABC123'),
    ).toBe('1731600000');
  });

  it('is null for another stream, junk or no measurement id', () => {
    expect(analyticsSessionIdFromCookieHeader('_ga_OTHER=GS1.1.1731600000.4.1', 'G-ABC123')).toBeNull();
    expect(analyticsSessionIdFromCookieHeader('_ga_ABC123=GS1.1.junk', 'G-ABC123')).toBeNull();
    expect(analyticsSessionIdFromCookieHeader('_ga_ABC123=GS1.1.1731600000.4.1', '')).toBeNull();
  });
});

describe('marketing-only server events', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PUBLIC_GA4_MEASUREMENT_ID', 'G-TEST');
    vi.stubEnv('GA4_MEASUREMENT_PROTOCOL_API_SECRET', 'secret');
    vi.stubEnv('VERCEL_ENV', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('allows the funnel events and drops Shop Hub / admin / ops activity', () => {
    for (const name of ['preview_viewed', 'preview_converted', 'signup_completed', 'saas_subscription_paid']) {
      expect(isMarketingServerEvent(name)).toBe(true);
    }
    for (const name of [
      'hub_viewed',
      'hub_add_menu_open',
      'hub_add_menu_item',
      'hub_asset_uploaded',
      'hub_details_saved',
      'hub_message_sent',
      'launch_checklist_item_completed',
      'launch_approved',
      'site_live',
    ]) {
      expect(isMarketingServerEvent(name)).toBe(false);
    }
  });

  it('never posts a hub event to GA4', async () => {
    expect(await sendServerAnalyticsEvent({ name: 'hub_add_menu_open', clientId: '123.456' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing from a Vercel preview deployment', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(await sendServerAnalyticsEvent({ name: 'signup_completed', clientId: '123.456' })).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await sendServerAnalyticsEvent({ name: 'signup_completed', clientId: '123.456' })).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('joins the visitor session when the session id is known', async () => {
    await sendServerAnalyticsEvent({
      name: 'signup_completed',
      clientId: '123.456',
      sessionId: '1731600000',
      params: { method: 'email' },
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: '123.456',
      events: [
        {
          name: 'signup_completed',
          params: { method: 'email', session_id: '1731600000', engagement_time_msec: 1 },
        },
      ],
    });
  });
});
