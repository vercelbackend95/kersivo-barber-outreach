/**
 * Sentry helpers — safe when DSN is unset (no-op).
 */
import * as Sentry from '@sentry/astro';

export type OpsSentryLevel = 'warning' | 'error' | 'fatal';

type OpsScopeContext = {
  route?: string;
  shopId?: string;
  tags?: Record<string, string>;
};

function resolveDsn(): string {
  return (import.meta.env.SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').toString().trim();
}

function applyOpsScope(
  scope: { setTag: (key: string, value: string) => void },
  context: OpsScopeContext,
): void {
  if (context.route) scope.setTag('route', context.route);
  if (context.shopId) scope.setTag('shopId', context.shopId);
  for (const [key, value] of Object.entries(context.tags ?? {})) {
    scope.setTag(key, value);
  }
}

export function captureOpsException(
  error: unknown,
  context: OpsScopeContext = {},
): void {
  if (!resolveDsn()) return;

  Sentry.withScope((scope) => {
    applyOpsScope(scope, context);
    Sentry.captureException(error);
  });
}

/**
 * Operational alert that is not necessarily an exception.
 * Prefer fixed safe message strings + minimised tags (no raw provider bodies).
 */
export function captureOpsMessage(
  message: string,
  context: OpsScopeContext & { level?: OpsSentryLevel } = {},
): void {
  if (!resolveDsn()) return;

  const level = context.level ?? 'error';
  Sentry.withScope((scope) => {
    applyOpsScope(scope, context);
    Sentry.captureMessage(message, level);
  });
}

export function isSentryEnabled(): boolean {
  return Boolean(resolveDsn());
}
