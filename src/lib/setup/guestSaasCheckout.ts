import { prisma } from '@/lib/db/client';
import {
  recordTermsAcceptance,
  termsAcceptanceStripeMetadata,
} from '@/lib/legal/requireTermsAcceptance';
import { TERMS_ACCEPTANCE_PURPOSES } from '@/lib/legal/termsVersion';
import { SAAS_MONTHLY_PENCE } from '@/lib/seo/defaults';
import {
  BLOCKING_SAAS_STATUSES,
  isBlockingSaasStatus,
  isPrismaUniqueConflict,
  resolveExistingCheckoutOutcome,
  saasCheckoutIdempotencyKey,
  saasCheckoutSuccess,
} from '@/lib/setup/saasCheckoutGuard';
import { buildSaasSubscriptionStripeMetadata } from '@/lib/setup/saasSubscription';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import {
  createSubscriptionCheckoutSession,
  retrieveCheckoutSession,
} from '@/lib/shop/stripe';

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
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

export type GuestSaasCheckoutInput = {
  request: Request;
  name: string;
  /** Lower-cased, validated. */
  email: string;
  shopName: string;
  shopSize: string;
  currentStack: string;
  checkoutAttemptId: string;
  /** Ownerless draft shop the subscription will be attached to (guest preview cookie or free preview). */
  previewShopId: string | null;
  /** Extra Stripe metadata (free preview: previewRequestId). */
  extraMetadata?: Record<string, string>;
  /** Defaults to /setup/cancel. */
  cancelPath?: string;
};

/**
 * Guest £39 SaaS checkout after input validation and Terms acceptance. When a preview shopId is bound,
 * at most one PENDING/open row may exist (partial unique index) — reuse or release before creating again.
 * Shared by /api/setup/subscription-checkout and the free preview launch.
 */
export async function runGuestSaasCheckout(input: GuestSaasCheckoutInput): Promise<Response> {
  const { request, name, email, shopName, shopSize, currentStack, checkoutAttemptId, previewShopId } = input;

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

  const session = await createSubscriptionCheckoutSession({
    customerEmail: email,
    successUrl: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}${input.cancelPath ?? '/setup/cancel'}`,
    productId: 'saas-subscription',
    name: 'Kersivo — monthly subscription',
    unitAmount: SAAS_MONTHLY_PENCE,
    idempotencyKey: saasCheckoutIdempotencyKey(checkoutAttemptId),
    metadata: {
      ...buildSaasSubscriptionStripeMetadata({
        checkoutAttemptId,
        shopId: previewShopId,
      }),
      ...(input.extraMetadata ?? {}),
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
}
