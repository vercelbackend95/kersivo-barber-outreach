export const prerender = false;

import type { APIRoute } from 'astro';
import {
  parseTermsAccepted,
  termsAcceptedErrorResponse,
} from '../../../lib/legal/requireTermsAcceptance';
import { parseCheckoutAttemptId } from '../../../lib/setup/saasCheckoutGuard';
import { runGuestSaasCheckout } from '../../../lib/setup/guestSaasCheckout';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import { resolvePreviewShopIdFromRequest } from '@/lib/preview/shopPreviewSession';

type SubscriptionCheckoutInput = {
  name: string;
  email: string;
  shopName: string;
  shopSize: string;
  currentStack: string;
  townCity?: string | null;
  barbers?: string | null;
  termsAccepted?: boolean;
  checkoutAttemptId?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_META = 120;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400 });
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

/**
 * Guest SaaS checkout. When a preview shopId is bound, at most one PENDING/open
 * row may exist (partial unique index) — reuse or release before creating again.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const limited = await enforceIpRateLimit(request, 'setup_checkout', 10, 15 * 60 * 1000);
    if (limited) return limited;

    let body: SubscriptionCheckoutInput;
    try {
      body = (await request.json()) as SubscriptionCheckoutInput;
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

    const name = body.name?.trim() ?? '';
    if (name.length < 2) {
      return badRequest('Name must be at least 2 characters.');
    }

    const email = body.email?.trim().toLowerCase() ?? '';
    if (!email || !EMAIL_REGEX.test(email)) {
      return badRequest('Valid email is required.');
    }

    const shopName = body.shopName?.trim() ?? '';
    if (shopName.length < 2) {
      return badRequest('Shop name must be at least 2 characters.');
    }

    const shopSize = body.shopSize?.trim() ?? '';
    if (!shopSize || shopSize.length > MAX_META) {
      return badRequest('Shop size is required.');
    }

    const currentStack = body.currentStack?.trim() ?? '';
    if (!currentStack || currentStack.length > MAX_META) {
      return badRequest('Current stack is required.');
    }

    const previewShopId = await resolvePreviewShopIdFromRequest(request);

    return await runGuestSaasCheckout({
      request,
      name,
      email,
      shopName,
      shopSize,
      currentStack,
      checkoutAttemptId,
      previewShopId,
    });
  } catch (error) {
    console.error('SaaS subscription checkout session creation failed', error);
    const detail =
      import.meta.env.DEV && error instanceof Error ? error.message : 'Unable to create checkout session.';
    return jsonResponse({ error: detail }, 500);
  }
};
