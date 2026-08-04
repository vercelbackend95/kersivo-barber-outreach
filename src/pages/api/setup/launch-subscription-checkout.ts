export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { requirePermission } from '../../../lib/admin/rbac/can';
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
  withSaasShopCheckoutLock,
} from '../../../lib/setup/saasCheckoutGuard';
import { buildSaasSubscriptionStripeMetadata } from '../../../lib/setup/saasSubscription';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import {
  createSubscriptionCheckoutSession,
  retrieveCheckoutSession,
} from '../../../lib/shop/stripe';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

type LaunchSubscriptionCheckoutInput = {
  attribution?: Record<string, string>;
  termsAccepted?: boolean;
  checkoutAttemptId?: string;
};

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
  console.error('Launch subscription checkout Stripe session lookup failed', outcome.error);
  return jsonResponse(
    { error: 'Unable to verify existing checkout session. Please try again shortly.' },
    503,
  );
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

    const baseUrl = getPublicSiteUrl();
    const attribution = pickAttribution(body.attribution);

    return await withSaasShopCheckoutLock(access.shopId, async () => {
      const openSub = await prisma.saasSubscription.findFirst({
        where: {
          shopId: access.shopId,
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
        return jsonResponse(
          {
            error: 'This barbershop already has a KERSIVO subscription.',
            code: 'SUBSCRIPTION_ALREADY_EXISTS',
            redirectTo: '/admin',
          },
          409,
        );
      }

      if (openSub?.status === 'PENDING') {
        const outcome = await outcomeForExistingSession(openSub.stripeSessionId);

        if (outcome.kind === 'open' || outcome.kind === 'complete') {
          return responseForExistingOutcome(outcome);
        }

        if (outcome.kind === 'lookup_failed') {
          return responseForExistingOutcome(outcome);
        }

        // Expired PENDING: remove unpaid row only.
        await prisma.saasSubscription.delete({ where: { id: openSub.id } }).catch((error) => {
          console.error('Failed to delete expired PENDING SaaS subscription', {
            id: openSub.id,
            error,
          });
        });

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

      // Same attempt may already exist (e.g. guest→auth race or prior partial write).
      const byAttempt = await prisma.saasSubscription.findUnique({
        where: { checkoutAttemptId },
        select: { stripeSessionId: true, shopId: true, status: true },
      });
      if (byAttempt) {
        if (byAttempt.shopId && byAttempt.shopId !== access.shopId) {
          return badRequest('checkoutAttemptId does not match this shop.');
        }
        return responseForExistingOutcome(await outcomeForExistingSession(byAttempt.stripeSessionId));
      }

      const shopSize =
        openSub?.shopSize?.trim() || shopSizeFromBarberCount(shop._count.barbers);
      const currentStack = openSub?.currentStack?.trim() || 'kersivo-preview';

      const metadata = {
        ...buildSaasSubscriptionStripeMetadata(
          {
            customerName: name,
            email,
            shopName,
            shopSize,
            currentStack,
            checkoutAttemptId,
            shopId: access.shopId,
          },
          attribution,
        ),
        ...termsAcceptanceStripeMetadata(),
      };

      const session = await createSubscriptionCheckoutSession({
        customerEmail: email,
        successUrl: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/setup/cancel`,
        productId: 'saas-subscription',
        name: 'Kersivo — monthly subscription',
        unitAmount: SAAS_MONTHLY_PENCE,
        idempotencyKey: saasCheckoutIdempotencyKey(checkoutAttemptId),
        metadata,
      });

      try {
        await prisma.saasSubscription.create({
          data: {
            stripeSessionId: session.id,
            checkoutAttemptId,
            shopId: access.shopId,
            status: 'PENDING',
            customerName: name,
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
          const byAttempt = await prisma.saasSubscription.findUnique({
            where: { checkoutAttemptId },
            select: { stripeSessionId: true, status: true },
          });
          const byShop =
            byAttempt ??
            (await prisma.saasSubscription.findFirst({
              where: {
                shopId: access.shopId,
                status: { in: [...BLOCKING_SAAS_STATUSES, 'PENDING'] },
              },
              orderBy: { createdAt: 'desc' },
              select: { stripeSessionId: true, status: true },
            }));

          if (byShop && isBlockingSaasStatus(byShop.status)) {
            return jsonResponse(
              {
                error: 'This barbershop already has a KERSIVO subscription.',
                code: 'SUBSCRIPTION_ALREADY_EXISTS',
                redirectTo: '/admin',
              },
              409,
            );
          }

          if (byShop?.stripeSessionId) {
            return responseForExistingOutcome(await outcomeForExistingSession(byShop.stripeSessionId));
          }
        }

        console.error('Launch subscription PENDING record create failed', {
          stripeSessionId: session.id,
          checkoutAttemptId,
          shopId: access.shopId,
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
        userId: access.userId,
        shopId: access.shopId,
        stripeSessionId: session.id,
        request: context.request,
      });

      return jsonResponse(
        saasCheckoutSuccess({ url: session.url, reused: false, state: 'open' }),
        200,
      );
    });
  } catch (error) {
    console.error('Launch subscription checkout session creation failed', error);
    const detail =
      import.meta.env.DEV && error instanceof Error ? error.message : 'Unable to create checkout session.';
    return jsonResponse({ error: detail }, 500);
  }
};
