import { SAAS_MONTHLY_PENCE } from '@/lib/seo/defaults';

export const SAAS_SUBSCRIPTION_METADATA_TYPE = 'saas_subscription';

export function buildSaasSubscriptionStripeMetadata(
  input: {
    customerName: string;
    email: string;
    shopName: string;
    shopSize: string;
    currentStack: string;
    townCity?: string | null;
    barbers?: string | null;
    shopId?: string | null;
  },
  attribution: Record<string, string> = {},
): Record<string, string> {
  const metadata: Record<string, string> = {
    type: SAAS_SUBSCRIPTION_METADATA_TYPE,
    customerName: input.customerName.slice(0, 200),
    email: input.email.slice(0, 200),
    shopName: input.shopName.slice(0, 200),
    shopSize: input.shopSize.slice(0, 120),
    currentStack: input.currentStack.slice(0, 120),
    monthly_amount: String(SAAS_MONTHLY_PENCE),
  };

  if (input.townCity?.trim()) metadata.townCity = input.townCity.trim().slice(0, 200);
  if (input.barbers?.trim()) metadata.barbers = input.barbers.trim().slice(0, 500);
  if (input.shopId?.trim()) metadata.shopId = input.shopId.trim().slice(0, 120);

  for (const [key, value] of Object.entries(attribution)) {
    if (value.trim()) metadata[key] = value.trim().slice(0, 200);
  }

  return metadata;
}
