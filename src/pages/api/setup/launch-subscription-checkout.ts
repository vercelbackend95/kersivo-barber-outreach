export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { requirePermission } from '../../../lib/admin/rbac/can';
import { prisma } from '../../../lib/db/client';
import {
  parseTermsAccepted,
  termsAcceptedErrorResponse,
} from '../../../lib/legal/requireTermsAcceptance';
import {
  runAuthenticatedSaasCheckout,
  saasCheckoutJsonResponse as jsonResponse,
} from '../../../lib/setup/authenticatedSaasCheckout';
import { parseCheckoutAttemptId } from '../../../lib/setup/saasCheckoutGuard';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import { shopDepartureInProgressResponse } from '@/lib/shop/shopDeparture';

type LaunchSubscriptionCheckoutInput = {
  termsAccepted?: boolean;
  checkoutAttemptId?: string;
};

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400 });
}

/**
 * Authenticated subscription checkout for Launch Wizard (Owner / billing.manage only).
 */
export const POST: APIRoute = async (context) => {
  try {
    const limited = await enforceIpRateLimit(context.request, 'setup_checkout', 10, 15 * 60 * 1000);
    if (limited) return limited;

    const access = await resolveAdminAccess(context);
    if (!access || access.via !== 'session') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const denied = requirePermission(access, 'billing.manage');
    if (denied) return denied;

    let body: LaunchSubscriptionCheckoutInput;
    try {
      body = (await context.request.json()) as LaunchSubscriptionCheckoutInput;
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

    if (!shop?.onboardingCompleted) {
      return badRequest('Complete workspace setup before launching.');
    }

    const name = (access.userName ?? '').trim();
    if (name.length < 2) {
      return badRequest('Account name is required.');
    }

    const email = (access.userEmail ?? '').trim().toLowerCase();
    if (!email) {
      return badRequest('Account email is required.');
    }

    const shopName = shop.name.trim();
    if (shopName.length < 2) {
      return badRequest('Shop name is required.');
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
      checkEligibility: async (tx) => {
        const paidMarker = await tx.shopSettings.findUnique({
          where: { id: access.shopId },
          select: { shopPaidAt: true, departure: { select: { status: true } } },
        });
        if (!paidMarker) {
          return jsonResponse({ error: 'Shop not found.' }, 404);
        }
        if (paidMarker.departure) {
          return shopDepartureInProgressResponse();
        }
        if (paidMarker.shopPaidAt != null) {
          console.warn('[launch-subscription-checkout] shopPaidAt set; blocking checkout', {
            shopId: access.shopId,
          });
          return jsonResponse(
            {
              error: 'This barbershop already has an active KERSIVO account.',
              code: 'SUBSCRIPTION_ALREADY_EXISTS',
              redirectTo: '/admin',
            },
            409,
          );
        }
        return null;
      },
    });
  } catch (error) {
    console.error('Launch subscription checkout session creation failed', error);
    const detail =
      import.meta.env.DEV && error instanceof Error ? error.message : 'Unable to create checkout session.';
    return jsonResponse({ error: detail }, 500);
  }
};
