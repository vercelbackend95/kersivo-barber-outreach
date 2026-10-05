export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess, requireVerifiedEmail } from '@/lib/admin/auth';
import { shopMeetsOnboardingCompletionRequirements } from '@/lib/admin/onboarding';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { parseTermsAccepted, termsAcceptedErrorResponse } from '@/lib/legal/requireTermsAcceptance';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import {
  SAAS_CHECKOUT_CANCEL_PATH_DEFAULT,
  SAAS_CHECKOUT_CANCEL_PATH_ONBOARDING,
  runAuthenticatedSaasCheckout,
  saasCheckoutJsonResponse as jsonResponse,
  subscriptionAlreadyExistsResponse,
} from '@/lib/setup/authenticatedSaasCheckout';
import {
  BILLING_RECOVERY_REQUIRED,
  resolveFullUpgradeEligibility,
} from '@/lib/setup/fullKersivoUpgrade';
import { parseCheckoutAttemptId } from '@/lib/setup/saasCheckoutGuard';
import { SAAS_CHECKOUT_SOURCE_ADMIN_UPGRADE } from '@/lib/setup/saasSubscription';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';

type UpgradeCheckoutInput = {
  termsAccepted?: unknown;
  checkoutAttemptId?: unknown;
  /** 'onboarding' when Full was chosen on the onboarding plan step. */
  returnTo?: unknown;
};

function badRequest(message: string, code?: string) {
  return jsonResponse(code ? { error: message, code } : { error: message }, 400);
}

/**
 * Authenticated "Upgrade to Full KERSIVO" checkout for an existing SETUP or Free Booking shop.
 * Same shop, same owner: the PENDING subscription row and Stripe metadata carry this shopId, so
 * the subscription webhook / success-page claim grants Full to this shop without copying data.
 */
export const POST: APIRoute = async (context) => {
  try {
    const limited = await enforceIpRateLimit(context.request, 'setup_checkout', 10, 15 * 60 * 1000);
    if (limited) return limited;

    const access = await resolveAdminAccess(context);
    if (!access) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (access.via !== 'session' || isDemoShopId(access.shopId)) {
      return jsonResponse(
        {
          error: 'Upgrading is only available from your own signed-in KERSIVO workspace.',
          code: 'UPGRADE_NOT_AVAILABLE',
        },
        403,
      );
    }
    const denied = requirePermission(access, 'billing.manage');
    if (denied) return denied;
    const unverified = requireVerifiedEmail(access);
    if (unverified) return unverified;

    let body: UpgradeCheckoutInput;
    try {
      body = (await context.request.json()) as UpgradeCheckoutInput;
    } catch {
      return badRequest('Invalid request body.');
    }

    if (!parseTermsAccepted(body)) {
      return termsAcceptedErrorResponse();
    }

    const checkoutAttemptId = parseCheckoutAttemptId(body.checkoutAttemptId);
    if (!checkoutAttemptId) {
      return badRequest('Valid checkoutAttemptId is required.');
    }

    const shop = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: {
        onboardingCompleted: true,
        name: true,
        _count: { select: { barbers: true } },
      },
    });
    if (!shop) {
      return jsonResponse({ error: 'Shop not found.' }, 404);
    }

    if (
      !shop.onboardingCompleted &&
      !(await shopMeetsOnboardingCompletionRequirements(access.shopId))
    ) {
      return badRequest(
        'Finish your shop, team, services and hours before upgrading.',
        'ONBOARDING_INCOMPLETE',
      );
    }

    const name = (access.userName ?? '').trim();
    if (name.length < 2) {
      return badRequest('Add your name to your account before upgrading.', 'ACCOUNT_NAME_REQUIRED');
    }

    const email = (access.userEmail ?? '').trim().toLowerCase();
    if (!email) {
      return badRequest('Your account needs an email address before upgrading.', 'ACCOUNT_EMAIL_REQUIRED');
    }

    const shopName = shop.name.trim();
    if (shopName.length < 2) {
      return badRequest('Add your shop name before upgrading.', 'SHOP_NAME_REQUIRED');
    }

    return await runAuthenticatedSaasCheckout({
      shopId: access.shopId,
      userId: access.userId,
      customerName: name,
      email,
      shopName,
      barberCount: shop._count.barbers,
      checkoutAttemptId,
      request: context.request,
      source: SAAS_CHECKOUT_SOURCE_ADMIN_UPGRADE,
      cancelPath:
        body.returnTo === 'onboarding'
          ? SAAS_CHECKOUT_CANCEL_PATH_ONBOARDING
          : SAAS_CHECKOUT_CANCEL_PATH_DEFAULT,
      checkEligibility: async (tx) => {
        const eligibility = await resolveFullUpgradeEligibility(access.shopId, new Date(), tx);
        if (eligibility.ok) return null;
        switch (eligibility.reason) {
          case 'already_full':
            return subscriptionAlreadyExistsResponse();
          case 'billing_recovery':
            return jsonResponse(
              {
                error:
                  'Your KERSIVO subscription has a payment issue. Update your payment details in billing instead of starting a new subscription.',
                code: BILLING_RECOVERY_REQUIRED,
                billingPortal: true,
              },
              409,
            );
          case 'shop_not_found':
            return jsonResponse({ error: 'Shop not found.' }, 404);
          case 'not_purchasable':
          default:
            return jsonResponse(
              {
                error: 'Upgrading is only available from your own signed-in KERSIVO workspace.',
                code: 'UPGRADE_NOT_AVAILABLE',
              },
              403,
            );
        }
      },
    });
  } catch (error) {
    console.error('Full KERSIVO upgrade checkout failed', error);
    const detail =
      import.meta.env.DEV && error instanceof Error ? error.message : 'Unable to start checkout.';
    return jsonResponse({ error: detail }, 500);
  }
};
