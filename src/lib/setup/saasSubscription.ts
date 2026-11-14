import {
  GA_CLIENT_ID_METADATA_KEY,
  GA_SESSION_ID_METADATA_KEY,
  analyticsClientIdFromCookieHeader,
  analyticsSessionIdFromCookieHeader,
} from '@/lib/analytics/serverEvents';

export const SAAS_SUBSCRIPTION_METADATA_TYPE = 'saas_subscription';

/** In-dashboard upgrade of an existing SETUP / Free Booking shop (drives the success-page copy). */
export const SAAS_CHECKOUT_SOURCE_ADMIN_UPGRADE = 'admin_upgrade';

export type SaasCheckoutSource = typeof SAAS_CHECKOUT_SOURCE_ADMIN_UPGRADE;

/**
 * Minimised Stripe Checkout metadata for the £39 SaaS subscription.
 * Direct customer/shop PII lives on the Neon PENDING SaasSubscription row, not in Stripe metadata.
 * Campaign attribution (gclid / gbraid / wbraid / UTMs) is intentionally not persisted.
 */
export function buildSaasSubscriptionStripeMetadata(input: {
  checkoutAttemptId: string;
  shopId?: string | null;
  source?: SaasCheckoutSource;
  /** Visitor's GA client / session id (consent given, not internal) so the webhook can send saas_subscription_paid. */
  gaClientId?: string | null;
  gaSessionId?: string | null;
}): Record<string, string> {
  const metadata: Record<string, string> = {
    type: SAAS_SUBSCRIPTION_METADATA_TYPE,
    checkoutAttemptId: input.checkoutAttemptId.slice(0, 120),
  };

  if (input.shopId?.trim()) metadata.shopId = input.shopId.trim().slice(0, 120);
  if (input.source) metadata.source = input.source;
  if (input.gaClientId?.trim()) metadata[GA_CLIENT_ID_METADATA_KEY] = input.gaClientId.trim().slice(0, 100);
  if (input.gaClientId?.trim() && input.gaSessionId?.trim()) {
    metadata[GA_SESSION_ID_METADATA_KEY] = input.gaSessionId.trim().slice(0, 40);
  }

  return metadata;
}

/** GA ids for the checkout metadata: both null without Analytics consent or for internal traffic. */
export function analyticsIdsForCheckout(request: Request | null | undefined): {
  gaClientId: string | null;
  gaSessionId: string | null;
} {
  const cookieHeader = request?.headers.get('cookie') ?? null;
  const gaClientId = analyticsClientIdFromCookieHeader(cookieHeader);
  return {
    gaClientId,
    gaSessionId: gaClientId ? analyticsSessionIdFromCookieHeader(cookieHeader) : null,
  };
}
