export const SAAS_SUBSCRIPTION_METADATA_TYPE = 'saas_subscription';

/**
 * Minimised Stripe Checkout metadata for the £39 SaaS subscription.
 * Direct customer/shop PII lives on the Neon PENDING SaasSubscription row, not in Stripe metadata.
 * Campaign attribution (gclid / gbraid / wbraid / UTMs) is intentionally not persisted.
 */
export function buildSaasSubscriptionStripeMetadata(input: {
  checkoutAttemptId: string;
  shopId?: string | null;
}): Record<string, string> {
  const metadata: Record<string, string> = {
    type: SAAS_SUBSCRIPTION_METADATA_TYPE,
    checkoutAttemptId: input.checkoutAttemptId.slice(0, 120),
  };

  if (input.shopId?.trim()) metadata.shopId = input.shopId.trim().slice(0, 120);

  return metadata;
}
