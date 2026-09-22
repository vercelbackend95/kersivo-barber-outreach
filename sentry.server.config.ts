import * as Sentry from '@sentry/astro';
import { scrubSentryEvent } from '@/lib/ops/sentryPiiScrub';

/**
 * Idempotent server Sentry init.
 * Loaded by Astro page-ssr injection and by src/middleware.ts so API routes
 * also get a client (page-ssr alone does not run for /api/*).
 */
export function ensureSentryServerInitialized(): void {
  if (Sentry.isInitialized()) return;

  const dsn = (import.meta.env.SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').toString().trim();

  Sentry.init({
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    environment:
      (import.meta.env.SENTRY_ENVIRONMENT ?? process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? 'development')
        .toString()
        .trim() || 'development',
    tracesSampleRate: 0.05,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

ensureSentryServerInitialized();
