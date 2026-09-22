/**
 * Shared PII scrubbing for Sentry events (server).
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?[0-9][0-9\s()-]{7,}[0-9]/g;

export function scrubPiiText(value: string): string {
  return value
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(PHONE_RE, '[redacted-phone]');
}

export function scrubPiiValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return scrubPiiText(value);
  }
  if (Array.isArray(value)) return value.map(scrubPiiValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('email') ||
        lower.includes('phone') ||
        lower.includes('password') ||
        lower.includes('token') ||
        lower.includes('authorization') ||
        lower.includes('cookie')
      ) {
        out[key] = '[redacted]';
      } else {
        out[key] = scrubPiiValue(nested);
      }
    }
    return out;
  }
  return value;
}

/** Origin + pathname only — strip query strings and fragments (manage/auth tokens). */
export function sanitizeSentryRequestUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const q = url.indexOf('?');
    const h = url.indexOf('#');
    let end = url.length;
    if (q >= 0) end = Math.min(end, q);
    if (h >= 0) end = Math.min(end, h);
    return url.slice(0, end);
  }
}

type SentryLikeEvent = {
  message?: string;
  extra?: Record<string, unknown>;
  user?: Record<string, unknown>;
  request?: {
    url?: string;
    data?: unknown;
    headers?: Record<string, string>;
  };
  exception?: {
    values?: Array<{ value?: string; type?: string }>;
  };
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
};

/**
 * Mutates and returns a Sentry event with customer PII stripped from common surfaces.
 */
export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  if (typeof event.message === 'string') {
    event.message = scrubPiiText(event.message);
  }

  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (typeof value.value === 'string') {
        value.value = scrubPiiText(value.value);
      }
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      const next = { ...crumb };
      if (typeof next.message === 'string') {
        next.message = scrubPiiText(next.message);
      }
      if (next.data) {
        next.data = scrubPiiValue(next.data) as Record<string, unknown>;
      }
      return next;
    });
  }

  if (event.extra) {
    event.extra = scrubPiiValue(event.extra) as typeof event.extra;
  }

  if (event.request) {
    if (event.request.data !== undefined) {
      event.request.data = scrubPiiValue(event.request.data) as typeof event.request.data;
    }
    if (event.request.headers) {
      const headers = { ...event.request.headers };
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (
          lower.includes('authorization') ||
          lower.includes('cookie') ||
          lower.includes('stripe-signature') ||
          lower.includes('x-admin-secret')
        ) {
          headers[key] = '[redacted]';
        }
      }
      event.request.headers = headers;
    }
    if (typeof event.request.url === 'string' && event.request.url) {
      event.request.url = sanitizeSentryRequestUrl(event.request.url);
    }
  }

  // Do not send direct identity fields (email / IP / username).
  if (event.user) {
    delete event.user;
  }

  return event;
}
