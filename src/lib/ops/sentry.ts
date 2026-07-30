/**
 * Sentry helpers — safe when DSN is unset (no-op).
 */
import * as Sentry from '@sentry/astro';

export function captureOpsException(
  error: unknown,
  context: { route?: string; shopId?: string; tags?: Record<string, string> } = {},
): void {
  const dsn = (import.meta.env.SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').toString().trim();
  if (!dsn) return;

  Sentry.withScope((scope) => {
    if (context.route) scope.setTag('route', context.route);
    if (context.shopId) scope.setTag('shopId', context.shopId);
    for (const [key, value] of Object.entries(context.tags ?? {})) {
      scope.setTag(key, value);
    }
    Sentry.captureException(error);
  });
}

export function isSentryEnabled(): boolean {
  return Boolean((import.meta.env.SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').toString().trim());
}
