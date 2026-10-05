import {
  getOrCreateSaasCheckoutAttemptId,
  rotateSaasCheckoutAttemptId,
} from '@/lib/setup/saasCheckoutAttempt.client';
import { runSaasCheckoutWithSingleRotate } from '@/lib/setup/saasCheckoutPayFlow.client';

export const FULL_KERSIVO_UPGRADE_CHECKOUT_ENDPOINT = '/api/admin/subscription/upgrade-checkout';

export type FullKersivoUpgradeCheckoutResult =
  | { kind: 'redirect'; url: string }
  | {
      kind: 'error';
      message: string;
      code: string | null;
      /** Existing subscription needs billing recovery in the Stripe Customer Portal. */
      billingPortal: boolean;
      redirectTo: string | null;
    };

const FALLBACK_ERROR = 'Unable to start checkout. Please try again.';

/**
 * Starts (or reuses) the authenticated Full KERSIVO checkout for the signed-in shop. One
 * checkoutAttemptId per tab; an expired attempt is rotated and retried once.
 */
export async function startFullKersivoUpgradeCheckout(options?: {
  /** Return a cancelled Checkout to the onboarding plan choice instead of /setup/cancel. */
  returnTo?: 'onboarding';
}): Promise<FullKersivoUpgradeCheckoutResult> {
  try {
    const { response, data } = await runSaasCheckoutWithSingleRotate({
      start: (checkoutAttemptId) =>
        fetch(FULL_KERSIVO_UPGRADE_CHECKOUT_ENDPOINT, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            termsAccepted: true,
            checkoutAttemptId,
            ...(options?.returnTo ? { returnTo: options.returnTo } : {}),
          }),
        }),
      getAttemptId: getOrCreateSaasCheckoutAttemptId,
      rotateAttemptId: rotateSaasCheckoutAttemptId,
    });

    if (response.ok && data.ok && typeof data.url === 'string' && data.url) {
      return { kind: 'redirect', url: data.url };
    }

    const body = data as typeof data & { billingPortal?: boolean };
    return {
      kind: 'error',
      message: body.error || FALLBACK_ERROR,
      code: typeof body.code === 'string' ? body.code : null,
      billingPortal: body.billingPortal === true,
      redirectTo: typeof body.redirectTo === 'string' ? body.redirectTo : null,
    };
  } catch {
    return { kind: 'error', message: FALLBACK_ERROR, code: null, billingPortal: false, redirectTo: null };
  }
}

/** Full-page navigation to Stripe-hosted Checkout / Customer Portal. */
export function redirectToStripe(url: string): void {
  window.location.assign(url);
}

/** Opens the Stripe Customer Portal for the shop's existing subscription. */
export async function openKersivoBillingPortal(): Promise<{ url: string } | { error: string }> {
  try {
    const response = await fetch('/api/setup/billing-portal', {
      method: 'POST',
      credentials: 'include',
    });
    const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !payload?.url) {
      return { error: payload?.error || 'Unable to open billing portal.' };
    }
    return { url: payload.url };
  } catch {
    return { error: 'Unable to open billing portal.' };
  }
}
