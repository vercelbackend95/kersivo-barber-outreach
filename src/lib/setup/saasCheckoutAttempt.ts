/** Shared browser/server constants for SaaS checkout attempt identity. */

export const SAAS_CHECKOUT_ATTEMPT_STORAGE_KEY = 'kersivo:saas-checkout-attempt:v1';

/** UUID v4 (and general UUID) shape accepted from clients. */
const CHECKOUT_ATTEMPT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCheckoutAttemptId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!CHECKOUT_ATTEMPT_ID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function saasCheckoutIdempotencyKey(checkoutAttemptId: string): string {
  return `kersivo_saas_subscription_checkout_${checkoutAttemptId}`;
}
