export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess, requireVerifiedEmail } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import {
  normalizeSaasCheckoutIdentity,
} from '@/lib/setup/saasCheckoutGuard';
import {
  assertClaimEntitlement,
  SUBSCRIPTION_NOT_ACTIVE_CODE,
} from '@/lib/setup/claimPaidSubscriptionEntitlement';
import { SAAS_SUBSCRIPTION_METADATA_TYPE } from '@/lib/setup/saasSubscription';
import { markShopPaid } from '@/lib/shop/markShopPaid';
import { retrieveCheckoutSession, retrieveSubscription } from '@/lib/shop/stripe';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function checkoutEmailFromSession(session: {
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string>;
}): string {
  const fromDetails = session.customer_details?.email?.trim() || '';
  const fromCustomer = session.customer_email?.trim() || '';
  const fromMeta = session.metadata?.email?.trim() || '';
  return fromDetails || fromCustomer || fromMeta;
}

async function ensurePaidMarker(shopId: string): Promise<Response | null> {
  try {
    await markShopPaid(shopId);
    return null;
  } catch (error) {
    console.error('[claim-paid-subscription] markShopPaid failed', {
      shopId,
      error,
    });
    return json(
      {
        error: 'Subscription linked but paid marker could not be set. Please retry.',
        code: 'MARK_SHOP_PAID_FAILED',
      },
      503,
    );
  }
}

async function denyUnlessEntitled(
  record: Parameters<typeof assertClaimEntitlement>[0]['record'],
  session: Parameters<typeof assertClaimEntitlement>[0]['session'],
): Promise<Response | null> {
  const result = await assertClaimEntitlement({
    record,
    session,
    retrieveSubscriptionFn: retrieveSubscription,
  });
  if (result.ok) return null;
  if (result.code === 'STRIPE_SUBSCRIPTION_LOOKUP_FAILED') {
    return json(
      {
        error: 'Unable to verify current Stripe subscription status.',
        code: result.code,
      },
      502,
    );
  }
  return json(
    {
      error: 'This subscription is not currently active.',
      code: SUBSCRIPTION_NOT_ACTIVE_CODE,
      reason: result.reason,
    },
    403,
  );
}

/**
 * After guest SaaS checkout, an authenticated Owner claims the paid subscription
 * onto their shop (email must match Stripe checkout exactly).
 */
export const POST: APIRoute = async (ctx) => {
  const limited = await enforceIpRateLimit(
    ctx.request,
    'claim_paid_subscription',
    20,
    60_000,
  );
  if (limited) return limited;

  const access = await resolveAdminAccess(ctx);
  if (!access || access.via !== 'session') {
    return json({ error: 'Unauthorized' }, 401);
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;
  const unverified = requireVerifiedEmail(access);
  if (unverified) return unverified;

  if (!access.userEmail?.trim()) {
    return json({ error: 'Signed-in user email is required.' }, 400);
  }

  let body: { stripeSessionId?: string };
  try {
    body = (await ctx.request.json()) as { stripeSessionId?: string };
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const stripeSessionId =
    typeof body.stripeSessionId === 'string' ? body.stripeSessionId.trim() : '';
  if (!stripeSessionId || !stripeSessionId.startsWith('cs_')) {
    return json({ error: 'Valid stripeSessionId is required.' }, 400);
  }

  let session;
  try {
    session = await retrieveCheckoutSession(stripeSessionId);
  } catch (error) {
    console.error('[claim-paid-subscription] stripe retrieve failed', error);
    return json({ error: 'Unable to verify Stripe checkout session.' }, 502);
  }

  const metadata = session.metadata ?? {};
  if (metadata.type !== SAAS_SUBSCRIPTION_METADATA_TYPE) {
    return json({ error: 'Checkout session is not a SaaS subscription purchase.' }, 400);
  }

  const paymentStatus = (session.payment_status ?? '').toLowerCase();
  if (paymentStatus !== 'paid') {
    return json({ error: 'Checkout session is not paid.' }, 400);
  }

  const paidEmail = checkoutEmailFromSession(session);
  if (!paidEmail) {
    return json({ error: 'Checkout session has no customer email.' }, 400);
  }

  const accessEmail = normalizeSaasCheckoutIdentity(access.userEmail);
  const checkoutEmail = normalizeSaasCheckoutIdentity(paidEmail);
  if (!accessEmail || accessEmail !== checkoutEmail) {
    return json(
      {
        error: 'Signed-in email must exactly match the paid checkout email.',
        code: 'EMAIL_MISMATCH',
      },
      403,
    );
  }

  const record = await prisma.saasSubscription.findUnique({
    where: { stripeSessionId },
  });
  if (!record) {
    return json({ error: 'Subscription record not found for this session.' }, 404);
  }

  // Belonging to another shop — never steal.
  if (record.shopId != null && record.shopId !== access.shopId) {
    return json(
      {
        error: 'This subscription is already linked to another shop.',
        code: 'ALREADY_OWNED',
      },
      409,
    );
  }

  // Already owned by this shop — entitlement then heal paid marker.
  if (record.shopId != null && record.shopId === access.shopId) {
    const entitlementError = await denyUnlessEntitled(record, session);
    if (entitlementError) return entitlementError;
    const healError = await ensurePaidMarker(access.shopId);
    if (healError) return healError;
    return json({
      ok: true,
      claimed: false,
      idempotent: true,
      shopId: access.shopId,
      subscriptionId: record.id,
    });
  }

  // shopId === null — check entitlement before linking + markShopPaid.
  const entitlementError = await denyUnlessEntitled(record, session);
  if (entitlementError) return entitlementError;

  const claimed = await prisma.saasSubscription.updateMany({
    where: { id: record.id, shopId: null },
    data: { shopId: access.shopId },
  });

  if (claimed.count === 0) {
    const again = await prisma.saasSubscription.findUnique({
      where: { id: record.id },
    });
    if (again?.shopId === access.shopId) {
      const againEntitlement = await denyUnlessEntitled(again, session);
      if (againEntitlement) return againEntitlement;
      const healError = await ensurePaidMarker(access.shopId);
      if (healError) return healError;
      return json({
        ok: true,
        claimed: false,
        idempotent: true,
        shopId: access.shopId,
        subscriptionId: record.id,
      });
    }
    return json(
      {
        error: 'This subscription was claimed by another shop.',
        code: 'CLAIM_RACE',
      },
      409,
    );
  }

  const paidError = await ensurePaidMarker(access.shopId);
  if (paidError) return paidError;

  return json({
    ok: true,
    claimed: true,
    idempotent: false,
    shopId: access.shopId,
    subscriptionId: record.id,
  });
};
