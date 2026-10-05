import type { Prisma, SaasSubscriptionStatus } from '@prisma/client';
import {
  recordTermsAcceptance,
  termsAcceptanceStripeMetadata,
} from '../legal/requireTermsAcceptance';
import { TERMS_ACCEPTANCE_PURPOSES } from '../legal/termsVersion';
import { SAAS_MONTHLY_PENCE } from '../seo/defaults';
import {
  BLOCKING_SAAS_STATUSES,
  guestCheckoutMatchesWorkspace,
  isBlockingSaasStatus,
  isPrismaUniqueConflict,
  resolveExistingCheckoutOutcome,
  saasCheckoutIdempotencyKey,
  saasCheckoutSuccess,
  withSaasShopCheckoutLock,
} from './saasCheckoutGuard';
import {
  buildSaasSubscriptionStripeMetadata,
  type SaasCheckoutSource,
} from './saasSubscription';
import { getPublicSiteUrl } from './siteUrl';
import {
  createSubscriptionCheckoutSession,
  retrieveCheckoutSession,
} from '../shop/stripe';

type AttemptRecord = {
  id: string;
  shopId: string | null;
  status: SaasSubscriptionStatus;
  stripeSessionId: string;
  checkoutAttemptId: string | null;
  customerEmail: string;
  shopName: string;
  shopSize: string;
  currentStack: string;
};

const ATTEMPT_RECORD_SELECT = {
  id: true,
  shopId: true,
  status: true,
  stripeSessionId: true,
  checkoutAttemptId: true,
  customerEmail: true,
  shopName: true,
  shopSize: true,
  currentStack: true,
} as const;

export function saasCheckoutJsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

const jsonResponse = saasCheckoutJsonResponse;

function shopSizeFromBarberCount(count: number): string {
  if (count <= 2) return '1-2';
  if (count <= 4) return '3-4';
  if (count <= 6) return '5-6';
  if (count <= 8) return '7-8';
  return '9+';
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
  console.error('Authenticated subscription checkout Stripe session lookup failed', outcome.error);
  return jsonResponse(
    { error: 'Unable to verify existing checkout session. Please try again shortly.' },
    503,
  );
}

export function subscriptionAlreadyExistsResponse() {
  return jsonResponse(
    {
      error: 'This barbershop already has a KERSIVO subscription.',
      code: 'SUBSCRIPTION_ALREADY_EXISTS',
      redirectTo: '/admin',
    },
    409,
  );
}

function checkoutAttemptExpiredRotateResponse() {
  return jsonResponse(
    {
      error: 'This checkout attempt is no longer active.',
      code: 'CHECKOUT_ATTEMPT_EXPIRED',
      rotateAttempt: true,
    },
    409,
  );
}

async function respondForOwnedAttemptRecord(
  tx: Prisma.TransactionClient,
  record: Pick<AttemptRecord, 'id' | 'status' | 'stripeSessionId'>,
) {
  if (isBlockingSaasStatus(record.status)) {
    return subscriptionAlreadyExistsResponse();
  }

  if (record.status === 'CANCELED') {
    return checkoutAttemptExpiredRotateResponse();
  }

  if (record.status !== 'PENDING') {
    return jsonResponse(
      {
        error: 'Unable to verify the existing subscription.',
        code: 'SUBSCRIPTION_STATE_UNAVAILABLE',
      },
      503,
    );
  }

  const outcome = await outcomeForExistingSession(record.stripeSessionId);
  if (outcome.kind === 'open' || outcome.kind === 'complete') {
    return responseForExistingOutcome(outcome);
  }
  if (outcome.kind === 'lookup_failed') {
    return responseForExistingOutcome(outcome);
  }

  // Expired PENDING: delete unpaid row only, then rotate.
  try {
    await tx.saasSubscription.delete({ where: { id: record.id } });
  } catch (error) {
    console.error('Failed to delete expired PENDING SaaS subscription', {
      id: record.id,
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

  return jsonResponse(
    {
      error: 'This checkout attempt has expired.',
      code: 'CHECKOUT_ATTEMPT_EXPIRED',
      rotateAttempt: true,
    },
    409,
  );
}

async function resolveP2002OnGuestLink(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<Response> {
  const openSub = await tx.saasSubscription.findFirst({
    where: {
      shopId,
      status: { in: [...BLOCKING_SAAS_STATUSES, 'PENDING'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      stripeSessionId: true,
    },
  });

  if (openSub && isBlockingSaasStatus(openSub.status)) {
    return subscriptionAlreadyExistsResponse();
  }

  if (openSub?.status === 'PENDING') {
    return respondForOwnedAttemptRecord(tx, openSub);
  }

  return jsonResponse(
    {
      error: 'Unable to link this checkout to the workspace. Please try again shortly.',
      code: 'CHECKOUT_LINK_FAILED',
    },
    503,
  );
}

export const SAAS_CHECKOUT_CANCEL_PATH_DEFAULT = '/setup/cancel';
export const SAAS_CHECKOUT_CANCEL_PATH_ONBOARDING = '/admin/onboarding?full_checkout=cancelled';

export type SaasCheckoutCancelPath =
  | typeof SAAS_CHECKOUT_CANCEL_PATH_DEFAULT
  | typeof SAAS_CHECKOUT_CANCEL_PATH_ONBOARDING;

export type AuthenticatedSaasCheckoutInput = {
  shopId: string;
  userId: string | null;
  /** Signed-in account name (≥ 2 chars, validated by the caller). */
  customerName: string;
  /** Lower-cased signed-in account email (validated by the caller). */
  email: string;
  shopName: string;
  barberCount: number;
  checkoutAttemptId: string;
  request: Request;
  source?: SaasCheckoutSource;
  /** First-party path Stripe returns to when Checkout is cancelled. */
  cancelPath?: SaasCheckoutCancelPath;
  /**
   * Runs first inside the shop checkout lock. Return a Response to stop (e.g. the shop is already
   * entitled), or null to continue. Must read through `tx` so the decision is race-safe.
   */
  checkEligibility: (tx: Prisma.TransactionClient) => Promise<Response | null>;
};

/**
 * Authenticated Full KERSIVO subscription checkout for an existing shop. Under the per-shop
 * advisory lock: eligibility → reuse/rotate the open PENDING attempt → claim a guest attempt →
 * Stripe Checkout (idempotent per attempt) → shop-owned PENDING row → SAAS_CHECKOUT Terms record.
 */
export async function runAuthenticatedSaasCheckout(
  input: AuthenticatedSaasCheckoutInput,
): Promise<Response> {
  const { shopId, checkoutAttemptId, email, shopName } = input;
  const baseUrl = getPublicSiteUrl();

  return withSaasShopCheckoutLock(shopId, async (tx) => {
    const ineligible = await input.checkEligibility(tx);
    if (ineligible) return ineligible;

    const openSub = await tx.saasSubscription.findFirst({
      where: {
        shopId,
        status: { in: [...BLOCKING_SAAS_STATUSES, 'PENDING'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        stripeSessionId: true,
        checkoutAttemptId: true,
        shopSize: true,
        currentStack: true,
      },
    });

    if (openSub && isBlockingSaasStatus(openSub.status)) {
      return subscriptionAlreadyExistsResponse();
    }

    if (openSub?.status === 'PENDING') {
      const outcome = await outcomeForExistingSession(openSub.stripeSessionId);

      if (outcome.kind === 'open' || outcome.kind === 'complete') {
        return responseForExistingOutcome(outcome);
      }

      if (outcome.kind === 'lookup_failed') {
        return responseForExistingOutcome(outcome);
      }

      // Expired PENDING: remove unpaid row only — fail closed on delete errors.
      try {
        await tx.saasSubscription.delete({ where: { id: openSub.id } });
      } catch (error) {
        console.error('Failed to delete expired PENDING SaaS subscription', {
          id: openSub.id,
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

      if (
        openSub.checkoutAttemptId &&
        openSub.checkoutAttemptId.toLowerCase() === checkoutAttemptId
      ) {
        return jsonResponse(
          {
            error: 'This checkout attempt has expired.',
            code: 'CHECKOUT_ATTEMPT_EXPIRED',
            rotateAttempt: true,
          },
          409,
        );
      }
      // Fresh attempt id after expired PENDING → fall through to create below.
    }

    // Guest→auth or prior attempt: claim/reuse by checkoutAttemptId only (never email lookup).
    const byAttempt = await tx.saasSubscription.findUnique({
      where: { checkoutAttemptId },
      select: ATTEMPT_RECORD_SELECT,
    });

    if (byAttempt) {
      if (byAttempt.shopId === shopId) {
        return respondForOwnedAttemptRecord(tx, byAttempt);
      }

      if (byAttempt.shopId != null && byAttempt.shopId !== shopId) {
        return jsonResponse(
          {
            error: 'This checkout attempt is already linked to another workspace.',
            code: 'CHECKOUT_ATTEMPT_ALREADY_LINKED',
          },
          409,
        );
      }

      // shopId === null — guest record; ownership checks then atomic claim.
      if (
        !guestCheckoutMatchesWorkspace({
          recordEmail: byAttempt.customerEmail,
          accessEmail: email,
          recordShopName: byAttempt.shopName,
          workspaceShopName: shopName,
        })
      ) {
        return jsonResponse(
          {
            error: 'This checkout attempt does not match this workspace.',
            code: 'CHECKOUT_ATTEMPT_OWNERSHIP_MISMATCH',
            rotateAttempt: true,
          },
          409,
        );
      }

      let owned: AttemptRecord = byAttempt;
      try {
        const linked = await tx.saasSubscription.updateMany({
          where: { id: byAttempt.id, shopId: null },
          data: { shopId },
        });

        if (linked.count === 1) {
          owned = { ...byAttempt, shopId };
        } else {
          const again = await tx.saasSubscription.findUnique({
            where: { id: byAttempt.id },
            select: ATTEMPT_RECORD_SELECT,
          });
          if (!again) {
            return jsonResponse(
              {
                error: 'Unable to link this checkout to the workspace. Please try again shortly.',
                code: 'CHECKOUT_LINK_FAILED',
              },
              503,
            );
          }
          if (again.shopId === shopId) {
            owned = again;
          } else if (again.shopId != null) {
            return jsonResponse(
              {
                error: 'This checkout attempt is already linked to another workspace.',
                code: 'CHECKOUT_ATTEMPT_ALREADY_LINKED',
              },
              409,
            );
          } else {
            return jsonResponse(
              {
                error: 'Unable to link this checkout to the workspace. Please try again shortly.',
                code: 'CHECKOUT_LINK_FAILED',
              },
              503,
            );
          }
        }
      } catch (error) {
        if (isPrismaUniqueConflict(error)) {
          return resolveP2002OnGuestLink(tx, shopId);
        }
        throw error;
      }

      return respondForOwnedAttemptRecord(tx, owned);
    }

    const shopSize = openSub?.shopSize?.trim() || shopSizeFromBarberCount(input.barberCount);
    const currentStack = openSub?.currentStack?.trim() || 'kersivo-preview';

    const metadata = {
      ...buildSaasSubscriptionStripeMetadata({
        checkoutAttemptId,
        shopId,
        source: input.source,
      }),
      ...termsAcceptanceStripeMetadata(),
    };

    const session = await createSubscriptionCheckoutSession({
      customerEmail: email,
      successUrl: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}${input.cancelPath ?? SAAS_CHECKOUT_CANCEL_PATH_DEFAULT}`,
      productId: 'saas-subscription',
      name: 'Kersivo — monthly subscription',
      unitAmount: SAAS_MONTHLY_PENCE,
      idempotencyKey: saasCheckoutIdempotencyKey(checkoutAttemptId),
      metadata,
    });

    try {
      await tx.saasSubscription.create({
        data: {
          stripeSessionId: session.id,
          checkoutAttemptId,
          shopId,
          status: 'PENDING',
          customerName: input.customerName,
          customerEmail: email,
          shopName,
          shopSize,
          currentStack,
          monthlyPence: SAAS_MONTHLY_PENCE,
          activatedAt: null,
        },
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const winnerAttempt = await tx.saasSubscription.findUnique({
          where: { checkoutAttemptId },
          select: { stripeSessionId: true, status: true },
        });
        const byShop =
          winnerAttempt ??
          (await tx.saasSubscription.findFirst({
            where: {
              shopId,
              status: { in: [...BLOCKING_SAAS_STATUSES, 'PENDING'] },
            },
            orderBy: { createdAt: 'desc' },
            select: { stripeSessionId: true, status: true },
          }));

        if (byShop && isBlockingSaasStatus(byShop.status)) {
          return subscriptionAlreadyExistsResponse();
        }

        if (byShop?.stripeSessionId) {
          return responseForExistingOutcome(await outcomeForExistingSession(byShop.stripeSessionId));
        }
      }

      console.error('Authenticated subscription PENDING record create failed', {
        stripeSessionId: session.id,
        checkoutAttemptId,
        shopId,
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
      userId: input.userId,
      shopId,
      stripeSessionId: session.id,
      request: input.request,
      db: tx,
    });

    return jsonResponse(
      saasCheckoutSuccess({ url: session.url, reused: false, state: 'open' }),
      200,
    );
  });
}
