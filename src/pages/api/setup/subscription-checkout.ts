export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db/client';
import {
  parseTermsAccepted,
  recordTermsAcceptance,
  termsAcceptanceStripeMetadata,
  termsAcceptedErrorResponse,
} from '../../../lib/legal/requireTermsAcceptance';
import { TERMS_ACCEPTANCE_PURPOSES } from '../../../lib/legal/termsVersion';
import { SAAS_MONTHLY_PENCE } from '../../../lib/seo/defaults';
import {
  BLOCKING_SAAS_STATUSES,
  isBlockingSaasStatus,
  isPrismaUniqueConflict,
  parseCheckoutAttemptId,
  resolveExistingCheckoutOutcome,
  saasCheckoutIdempotencyKey,
  saasCheckoutSuccess,
} from '../../../lib/setup/saasCheckoutGuard';
import { buildSaasSubscriptionStripeMetadata } from '../../../lib/setup/saasSubscription';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import {
  createSubscriptionCheckoutSession,
  retrieveCheckoutSession,
} from '../../../lib/shop/stripe';
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
  attribution?: Record<string, string>;
  termsAccepted?: boolean;
  checkoutAttemptId?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_META = 120;
const ATTRIBUTION_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'ga_client_id',
] as const;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400 });
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

function pickAttribution(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, 200);
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

async function outcomeForExistingSession(sessionId: string) {
  return resolveExistingCheckoutOutcome({
    sessionId,
    retrieve: retrieveCheckoutSession,
  });
}

function responseForExistingOutcome(
  outcome: Awaited<ReturnType<typeof outcomeForExistingSession>>,
) {
  if (outcome.kind === 'open') {
    return jsonResponse(
      saasCheckoutSuccess({ url: outcome.url, reused: true, state: 'open' }),
      200,
    );
  }
  if (outcome.kind === 'complete') {
    return jsonResponse(
      saasCheckoutSuccess({ url: outcome.url, reused: true, state: 'complete' }),
      200,
    );
  }
  if (outcome.kind === 'expired') {
    return jsonResponse(
      {
        error: 'This checkout attempt has expired.',
        code: 'CHECKOUT_ATTEMPT_EXPIRED',
        rotateAttempt: true,
      },
      409,
    );
  }
  console.error('SaaS guest checkout Stripe session lookup failed', outcome.error);
  return jsonResponse(
    { error: 'Unable to verify existing checkout session. Please try again shortly.' },
    503,
  );
}

async function deletePendingOrFail(id: string): Promise<Response | null> {
  try {
    await prisma.saasSubscription.delete({ where: { id } });
    return null;
  } catch (error) {
    console.error('Failed to delete expired/mismatched PENDING SaaS subscription', {
      id,
      error,
    });
    return jsonResponse(
      {
        error: 'Unable to release the expired checkout. Please try again shortly.',
        code: 'CHECKOUT_RELEASE_FAILED',
      },
      503,
    );
  }
}

function rotateMismatchResponse() {
  return jsonResponse(
    {
      error: 'This checkout attempt does not match this checkout.',
      code: 'CHECKOUT_ATTEMPT_MISMATCH',
      rotateAttempt: true,
    },
    409,
  );
}

function rotateExpiredResponse() {
  return jsonResponse(
    {
      error: 'This checkout attempt has expired.',
      code: 'CHECKOUT_ATTEMPT_EXPIRED',
      rotateAttempt: true,
    },
    409,
  );
}

function subscriptionAlreadyExistsResponse() {
  return jsonResponse(
    {
      error: 'This barbershop already has a KERSIVO subscription.',
      code: 'SUBSCRIPTION_ALREADY_EXISTS',
      redirectTo: '/admin',
    },
    409,
  );
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

    const existingByAttempt = await prisma.saasSubscription.findUnique({
      where: { checkoutAttemptId },
      select: {
        id: true,
        stripeSessionId: true,
        customerEmail: true,
        shopName: true,
        status: true,
      },
    });

    if (existingByAttempt) {
      if (
        existingByAttempt.customerEmail.trim().toLowerCase() !== email ||
        existingByAttempt.shopName.trim().toLowerCase() !== shopName.toLowerCase()
      ) {
        // Release unpaid PENDING so a rotated attempt can insert under one_open_per_shop.
        if (existingByAttempt.status === 'PENDING') {
          const releaseError = await deletePendingOrFail(existingByAttempt.id);
          if (releaseError) return releaseError;
        }
        return rotateMismatchResponse();
      }

      if (isBlockingSaasStatus(existingByAttempt.status)) {
        return subscriptionAlreadyExistsResponse();
      }

      if (existingByAttempt.status === 'PENDING') {
        const outcome = await outcomeForExistingSession(existingByAttempt.stripeSessionId);
        if (outcome.kind === 'open' || outcome.kind === 'complete') {
          return responseForExistingOutcome(outcome);
        }
        if (outcome.kind === 'lookup_failed') {
          return responseForExistingOutcome(outcome);
        }
        // Expired Stripe session: free the shop slot, then rotate.
        const releaseError = await deletePendingOrFail(existingByAttempt.id);
        if (releaseError) return releaseError;
        return rotateExpiredResponse();
      }
    }

    // Preview shop already has an open PENDING from a prior cancel — reuse it even if
    // the browser rotated checkoutAttemptId (one_open_per_shop blocks a second insert).
    if (previewShopId) {
      const openByShop = await prisma.saasSubscription.findFirst({
        where: {
          shopId: previewShopId,
          status: { in: [...BLOCKING_SAAS_STATUSES, 'PENDING'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          stripeSessionId: true,
        },
      });

      if (openByShop && isBlockingSaasStatus(openByShop.status)) {
        return subscriptionAlreadyExistsResponse();
      }

      if (openByShop?.status === 'PENDING') {
        const outcome = await outcomeForExistingSession(openByShop.stripeSessionId);
        if (outcome.kind === 'open' || outcome.kind === 'complete') {
          return responseForExistingOutcome(outcome);
        }
        if (outcome.kind === 'lookup_failed') {
          return responseForExistingOutcome(outcome);
        }
        const releaseError = await deletePendingOrFail(openByShop.id);
        if (releaseError) return releaseError;
        // Fall through to create a fresh checkout with the current attempt id.
      }
    }

    const baseUrl = getPublicSiteUrl();
    const attribution = pickAttribution(body.attribution);
    const townCity = typeof body.townCity === 'string' ? body.townCity.trim().slice(0, 200) : '';
    const barbers = typeof body.barbers === 'string' ? body.barbers.trim().slice(0, 500) : '';

    const session = await createSubscriptionCheckoutSession({
      customerEmail: email,
      successUrl: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/setup/cancel`,
      productId: 'saas-subscription',
      name: 'Kersivo — monthly subscription',
      unitAmount: SAAS_MONTHLY_PENCE,
      idempotencyKey: saasCheckoutIdempotencyKey(checkoutAttemptId),
      metadata: {
        ...buildSaasSubscriptionStripeMetadata(
          {
            customerName: name,
            email,
            shopName,
            shopSize,
            currentStack,
            checkoutAttemptId,
            townCity: townCity || null,
            barbers: barbers || null,
            shopId: previewShopId,
          },
          attribution,
        ),
        ...termsAcceptanceStripeMetadata(),
      },
    });

    try {
      await prisma.saasSubscription.create({
        data: {
          stripeSessionId: session.id,
          checkoutAttemptId,
          status: 'PENDING',
          customerName: name,
          customerEmail: email,
          shopName,
          shopSize,
          currentStack,
          monthlyPence: SAAS_MONTHLY_PENCE,
          activatedAt: null,
          ...(previewShopId ? { shopId: previewShopId } : {}),
        },
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const winnerAttempt = await prisma.saasSubscription.findUnique({
          where: { checkoutAttemptId },
          select: { stripeSessionId: true, status: true },
        });
        const winnerSession = winnerAttempt
          ? null
          : await prisma.saasSubscription.findUnique({
              where: { stripeSessionId: session.id },
              select: { stripeSessionId: true, status: true },
            });
        const winnerShop =
          winnerAttempt || winnerSession
            ? null
            : previewShopId
              ? await prisma.saasSubscription.findFirst({
                  where: {
                    shopId: previewShopId,
                    status: { in: [...BLOCKING_SAAS_STATUSES, 'PENDING'] },
                  },
                  orderBy: { createdAt: 'desc' },
                  select: { stripeSessionId: true, status: true },
                })
              : null;

        const winner = winnerAttempt ?? winnerSession ?? winnerShop;

        if (winner && isBlockingSaasStatus(winner.status)) {
          return subscriptionAlreadyExistsResponse();
        }

        if (winner?.stripeSessionId) {
          return responseForExistingOutcome(await outcomeForExistingSession(winner.stripeSessionId));
        }
      }

      console.error('SaaS subscription PENDING record create failed', {
        stripeSessionId: session.id,
        checkoutAttemptId,
        error,
      });
      return jsonResponse(
        { error: 'Unable to persist checkout. Please try again shortly.' },
        500,
      );
    }

    await recordTermsAcceptance({
      purpose: TERMS_ACCEPTANCE_PURPOSES.SAAS_CHECKOUT,
      email,
      stripeSessionId: session.id,
      request,
    });

    return jsonResponse(
      saasCheckoutSuccess({ url: session.url, reused: false, state: 'open' }),
      200,
    );
  } catch (error) {
    console.error('SaaS subscription checkout session creation failed', error);
    const detail =
      import.meta.env.DEV && error instanceof Error ? error.message : 'Unable to create checkout session.';
    return jsonResponse({ error: detail }, 500);
  }
};
