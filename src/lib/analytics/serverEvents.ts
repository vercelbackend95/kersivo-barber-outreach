import { isInternalTrafficCookie, INTERNAL_TRAFFIC_COOKIE } from '@/lib/analytics/internalTraffic';
import { CONSENT_COOKIE_NAME } from '@/lib/consent/config';
import { parseConsentCookieValue } from '@/lib/consent/storage';

/**
 * Server-side GA4 events (Measurement Protocol): the same GA4 property as gtag, for milestones the browser
 * cannot report (webhook) or must not report (the preview's URL holds its token, so that page loads no tags).
 * Sent only against the visitor's own GA client id, which exists only if they accepted Analytics cookies.
 * No client id means no event; the ops metrics in the database are the consent-independent record.
 * Never put names, emails, shop details or tokens in the params.
 */

const MEASUREMENT_PROTOCOL_URL = 'https://www.google-analytics.com/mp/collect';
const SEND_TIMEOUT_MS = 2000;

function readEnv(name: string): string {
  return ((import.meta.env as Record<string, string | undefined> | undefined)?.[name] ?? process.env[name] ?? '').trim();
}

function cookieValue(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1);
  }
  return null;
}

/** The GA client id from the request's cookies, or null without Analytics consent or for internal traffic. */
export function analyticsClientIdFromRequest(request: Request): string | null {
  const header = request.headers.get('cookie') ?? '';
  if (isInternalTrafficCookie(cookieValue(header, INTERNAL_TRAFFIC_COOKIE))) return null;

  const rawConsent = cookieValue(header, CONSENT_COOKIE_NAME);
  if (!rawConsent) return null;
  let consent: ReturnType<typeof parseConsentCookieValue>;
  try {
    consent = parseConsentCookieValue(decodeURIComponent(rawConsent));
  } catch {
    return null;
  }
  if (!consent?.analytics) return null;

  // _ga looks like GA1.1.123456789.1700000000; the client id is the last two parts.
  const match = /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(cookieValue(header, '_ga') ?? '');
  return match?.[1] ?? null;
}

/** Best effort and bounded: analytics must never fail or noticeably delay the request it describes. */
export async function sendServerAnalyticsEvent(input: {
  name: string;
  clientId: string | null | undefined;
  params?: Record<string, string | number>;
}): Promise<boolean> {
  const measurementId = readEnv('PUBLIC_GA4_MEASUREMENT_ID');
  const apiSecret = readEnv('GA4_MEASUREMENT_PROTOCOL_API_SECRET');
  if (!input.clientId || !measurementId || !apiSecret) return false;

  try {
    const url = `${MEASUREMENT_PROTOCOL_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.clientId,
        events: [{ name: input.name, params: input.params ?? {} }],
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.ok;
  } catch (error) {
    console.warn('[analytics] server event failed', { name: input.name, error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}
