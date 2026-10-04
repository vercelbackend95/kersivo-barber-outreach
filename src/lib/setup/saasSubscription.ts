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
}): Record<string, string> {
  const metadata: Record<string, string> = {
    type: SAAS_SUBSCRIPTION_METADATA_TYPE,
    checkoutAttemptId: input.checkoutAttemptId.slice(0, 120),
  };

  if (input.shopId?.trim()) metadata.shopId = input.shopId.trim().slice(0, 120);
  if (input.source) metadata.source = input.source;

  return metadata;
}
