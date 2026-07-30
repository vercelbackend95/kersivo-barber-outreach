import * as Sentry from '@sentry/astro';

const dsn = (import.meta.env.SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').toString().trim();

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(/\+?[0-9][0-9\s()-]{7,}[0-9]/g, '[redacted-phone]');
  }
  if (Array.isArray(value)) return value.map(scrubValue);
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
        out[key] = scrubValue(nested);
      }
    }
    return out;
  }
  return value;
}

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment:
    (import.meta.env.SENTRY_ENVIRONMENT ?? process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? 'development')
      .toString()
      .trim() || 'development',
  tracesSampleRate: 0.05,
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = scrubValue(event.request.data) as typeof event.request.data;
    }
    if (event.request?.headers) {
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
    if (event.extra) {
      event.extra = scrubValue(event.extra) as typeof event.extra;
    }
    return event;
  },
});
