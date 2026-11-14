import { isInternalTrafficCookie, INTERNAL_TRAFFIC_COOKIE } from '@/lib/analytics/internalTraffic';
import { CONSENT_COOKIE_NAME } from '@/lib/consent/config';
import { parseConsentCookieValue } from '@/lib/consent/storage';

/**
 * Server-side GA4 events (Measurement Protocol): the same GA4 property as gtag, for milestones the browser
 * cannot report (webhook) or must not report (the preview's URL holds its token, so that page loads no tags).
 * Sent only against the visitor's own GA client id, which exists only if they accepted Analytics cookies.
 * No client id means no event; the ops metrics in the database are the consent-independent record.
 * Never put names, emails, shop details or tokens in the params.
 *
 * Only marketing-funnel events reach GA4 (MARKETING_SERVER_EVENTS). Shop Hub / admin / ops activity
 * (hub_*, launch checklist, site_live) is product usage, already recorded in the database event log,
 * and is dropped here so it never shows up in marketing reports.
 */

/** Server-sent events that belong in the marketing property. Anything else is dropped. */
export const MARKETING_SERVER_EVENTS: ReadonlySet<string> = new Set([
  'preview_viewed',
  'preview_changes_requested',
  'preview_launch_click',
  'preview_checkout_started',
  'preview_converted',
  'preview_declined',
  'signup_completed',
  'saas_subscription_paid',
]);

export function isMarketingServerEvent(name: string): boolean {
  return MARKETING_SERVER_EVENTS.has(name);
}

/** Stripe Checkout metadata keys that carry the visitor's GA ids to the webhook. */
export const GA_CLIENT_ID_METADATA_KEY = 'gaClientId';
export const GA_SESSION_ID_METADATA_KEY = 'gaSessionId';

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
  return analyticsClientIdFromCookieHeader(request.headers.get('cookie'));
}

/** Same as analyticsClientIdFromRequest, for callers that only have the headers (Better Auth hooks). */
export function analyticsClientIdFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  const header = cookieHeader ?? '';
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

/**
 * The GA4 session id from the `_ga_<stream>` cookie, so a server event joins the visitor's session
 * (and its source / medium) instead of standing alone. Handles the GS1 and GS2 cookie formats.
 * Only call it after analyticsClientIdFromCookieHeader returned a client id (consent + not internal).
 */
export function analyticsSessionIdFromCookieHeader(
  cookieHeader: string | null | undefined,
  measurementId: string = readEnv('PUBLIC_GA4_MEASUREMENT_ID'),
): string | null {
  const suffix = measurementId.trim().replace(/^G-/i, '');
  if (!suffix) return null;
  const raw = cookieValue(cookieHeader ?? '', `_ga_${suffix}`);
  if (!raw) return null;
  const parts = raw.split('.');
  let candidate: string | undefined;
  if (parts[0] === 'GS1') candidate = parts[2];
  else if (parts[0] === 'GS2') candidate = parts[2]?.split('$').find((field) => field.startsWith('s'))?.slice(1);
  return candidate && /^\d{6,}$/.test(candidate) ? candidate : null;
}

/** Vercel preview deployments share the env vars; only production may write to the marketing property. */
function isNonProductionDeployment(): boolean {
  const vercelEnv = readEnv('VERCEL_ENV');
  return Boolean(vercelEnv) && vercelEnv !== 'production';
}

/** Best effort and bounded: analytics must never fail or noticeably delay the request it describes. */
export async function sendServerAnalyticsEvent(input: {
  name: string;
  clientId: string | null | undefined;
  /** GA4 session id (analyticsSessionIdFromCookieHeader) when known. */
  sessionId?: string | null;
  params?: Record<string, string | number>;
}): Promise<boolean> {
  if (!isMarketingServerEvent(input.name)) return false;
  if (isNonProductionDeployment()) return false;
  const measurementId = readEnv('PUBLIC_GA4_MEASUREMENT_ID');
  const apiSecret = readEnv('GA4_MEASUREMENT_PROTOCOL_API_SECRET');
  if (!input.clientId || !measurementId || !apiSecret) return false;

  const params: Record<string, string | number> = { ...(input.params ?? {}) };
  if (input.sessionId) {
    params.session_id = input.sessionId;
    params.engagement_time_msec = 1;
  }

  try {
    const url = `${MEASUREMENT_PROTOCOL_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.clientId,
        events: [{ name: input.name, params }],
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.ok;
  } catch (error) {
    console.warn('[analytics] server event failed', { name: input.name, error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}
