import * as Sentry from '@sentry/astro';
import { scrubSentryEvent } from '@/lib/ops/sentryPiiScrub';
import { isSentryServerEnabled } from '@/lib/ops/sentryEnabled';

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
    // Off for local dev unless SENTRY_ENABLE_LOCAL=true (see sentryEnabled.ts).
    enabled: isSentryServerEnabled({
      dsn,
      vercelEnv: (import.meta.env.VERCEL_ENV ?? process.env.VERCEL_ENV)?.toString(),
      enableLocal: (import.meta.env.SENTRY_ENABLE_LOCAL ?? process.env.SENTRY_ENABLE_LOCAL)?.toString(),
    }),
    sendDefaultPii: false,
    environment:
      (import.meta.env.SENTRY_ENVIRONMENT ?? process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? 'development')
        .toString()
        .trim() || 'development',
    // Commit SHA fixed at build time (astro.config.mjs); the runtime value covers tests and dev.
    release: (import.meta.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || '').toString().trim() || undefined,
    tracesSampleRate: 0.05,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

ensureSentryServerInitialized();
