import * as Sentry from '@sentry/astro';

const dsn = (import.meta.env.PUBLIC_SENTRY_DSN ?? import.meta.env.SENTRY_DSN ?? '').toString().trim();

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment:
    (import.meta.env.PUBLIC_SENTRY_ENVIRONMENT ?? import.meta.env.SENTRY_ENVIRONMENT ?? 'development')
      .toString()
      .trim() || 'development',
  tracesSampleRate: 0.05,
  // Browser: keep light; avoid shipping PII from forms.
  beforeSend(event) {
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url);
        url.search = '';
        event.request.url = url.toString();
      } catch {
        /* ignore */
      }
    }
    return event;
  },
});
