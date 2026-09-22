/**
 * Sentry helpers — safe when DSN is unset (no-op).
 */
import * as Sentry from '@sentry/astro';

export type OpsSentryLevel = 'warning' | 'error' | 'fatal';

export const OPS_ALERT_TAG = 'opsAlert';
export const OPS_ALERT_VALUE = 'true';

type OpsScopeContext = {
  route?: string;
  shopId?: string;
  tags?: Record<string, string>;
  /**
   * When true, sets deterministic opsAlert=true for Sentry Production ops alert rules.
   * Used for material operational exception captures only.
   */
  opsAlert?: boolean;
};

function resolveDsn(): string {
  return (import.meta.env.SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').toString().trim();
}

function applyOpsScope(
  scope: { setTag: (key: string, value: string) => void },
  context: OpsScopeContext,
  options: { forceOpsAlert?: boolean } = {},
): void {
  if (context.route) scope.setTag('route', context.route);
  if (context.shopId) scope.setTag('shopId', context.shopId);
  for (const [key, value] of Object.entries(context.tags ?? {})) {
    // Caller-supplied tags must not override the deterministic ops alert marker.
    if (key === OPS_ALERT_TAG) continue;
    scope.setTag(key, value);
  }
  if (options.forceOpsAlert || context.opsAlert) {
    scope.setTag(OPS_ALERT_TAG, OPS_ALERT_VALUE);
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
 * Always tags opsAlert=true for deterministic Sentry notification rules.
 */
export function captureOpsMessage(
  message: string,
  context: OpsScopeContext & { level?: OpsSentryLevel } = {},
): void {
  if (!resolveDsn()) return;

  const level = context.level ?? 'error';
  Sentry.withScope((scope) => {
    applyOpsScope(scope, context, { forceOpsAlert: true });
    Sentry.captureMessage(message, level);
  });
}

export function isSentryEnabled(): boolean {
  return Boolean(resolveDsn());
}
