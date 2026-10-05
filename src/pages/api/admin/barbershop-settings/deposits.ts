export const prerender = false;

import type { APIRoute } from 'astro';
import type { BookingPaymentMode } from '@prisma/client';
import { requireAdminContext } from '@/lib/admin/auth';
import { accessCan, requireAnyPermission, requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { BOOKING_DEPOSIT_PENCE } from '@/lib/booking/depositGate';
import {
  BOOKING_PAYMENT_NOT_READY,
  bookingPaymentModeForLegacyDepositToggle,
  calculatePlatformFeePence,
  FULL_PAYMENT_RETAINED_CAP_PENCE,
  kersivoPlatformFeeBps,
} from '@/lib/booking/bookingPaymentPolicy';
import {
  canStartBookingPaymentsOnboarding,
  evaluateBookingPayments,
} from '@/lib/booking/bookingPaymentsGate';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';
import { isPaidShop } from '@/lib/shop/paidShop';
import {
  createConnectAccountLink,
  createConnectStandardAccount,
  retrieveConnectAccount,
  StripeConnectApiError,
} from '@/lib/shop/stripeConnect';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

const BOOKING_PAYMENTS_NOT_AVAILABLE = 'BOOKING_PAYMENTS_NOT_AVAILABLE';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Booking payment settings + Connect status. Retail eligibility is reported separately. */
export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['shop.settings', 'billing.manage']);
  if (denied) return denied;

  const canManagePayouts = accessCan(access, 'billing.manage');

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      depositsEnabled: true,
      bookingPaymentMode: true,
      stripeConnectAccountId: true,
      stripeConnectAccountType: true,
      stripeConnectChargesEnabled: true,
      stripeConnectDetailsSubmitted: true,
      stripeConnectDisconnectedAt: true,
      cancellationWindowHours: true,
      rescheduleWindowHours: true,
      maxClientReschedules: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);

  let connect = {
    accountId: shop.stripeConnectAccountId,
    accountType: shop.stripeConnectAccountType,
    chargesEnabled: shop.stripeConnectChargesEnabled,
    detailsSubmitted: shop.stripeConnectDetailsSubmitted,
    disconnectedAt: shop.stripeConnectDisconnectedAt,
  };

  if (shop.stripeConnectAccountId && !shop.stripeConnectDisconnectedAt) {
    try {
      const live = await retrieveConnectAccount(shop.stripeConnectAccountId);
      if (
        live.chargesEnabled !== shop.stripeConnectChargesEnabled ||
        live.detailsSubmitted !== shop.stripeConnectDetailsSubmitted ||
        (live.accountType !== 'UNKNOWN' && live.accountType !== shop.stripeConnectAccountType)
      ) {
        await prisma.shopSettings.update({
          where: { id: shop.id },
          data: {
            stripeConnectChargesEnabled: live.chargesEnabled,
            stripeConnectDetailsSubmitted: live.detailsSubmitted,
            ...(live.accountType === 'STANDARD' || live.accountType === 'EXPRESS'
              ? { stripeConnectAccountType: live.accountType }
              : {}),
          },
        });
        connect = {
          accountId: shop.stripeConnectAccountId,
          accountType:
            live.accountType === 'STANDARD' || live.accountType === 'EXPRESS'
              ? live.accountType
              : shop.stripeConnectAccountType,
          chargesEnabled: live.chargesEnabled,
          detailsSubmitted: live.detailsSubmitted,
          disconnectedAt: null,
        };
      }
    } catch (error) {
      // A revoked/missing account must fail closed. Transient Stripe/network failures keep the last
      // known state, but authorization/resource failures mean KERSIVO can no longer use this account.
      if (
        error instanceof StripeConnectApiError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        const disconnectedAt = new Date();
        await prisma.shopSettings.update({
          where: { id: shop.id },
          data: {
            stripeConnectChargesEnabled: false,
            stripeConnectDetailsSubmitted: false,
            stripeConnectDisconnectedAt: disconnectedAt,
          },
        });
        connect = {
          ...connect,
          chargesEnabled: false,
          detailsSubmitted: false,
          disconnectedAt,
        };
      }
      // Other failures are treated as temporary Stripe/network unavailability.
    }
  }

  const kersivoAccess = await loadKersivoAccess(shop.id);
  const gate = evaluateBookingPayments({
    shop: {
      id: shop.id,
      stripeConnectAccountId: connect.accountId,
      stripeConnectChargesEnabled: connect.chargesEnabled,
    },
    access: kersivoAccess,
  });
  const platformFeeBps = kersivoPlatformFeeBps(kersivoAccess.state);

  return json({
    /** Paid (FULL_KERSIVO) entitlement — Retail stays Full-only. */
    paid: isPaidShop(shop),
    productState: kersivoAccess.state,
    bookingPaymentMode: shop.bookingPaymentMode,
    depositsEnabled: shop.depositsEnabled,
    depositAmountPence: BOOKING_DEPOSIT_PENCE,
    bookingPaymentsAvailable: canStartBookingPaymentsOnboarding({
      shopId: shop.id,
      access: kersivoAccess,
    }),
    bookingPaymentsReady: gate.ok,
    bookingPaymentsGateReason: gate.reason,
    collectReady:
      gate.ok && (shop.bookingPaymentMode === 'DEPOSIT' || shop.bookingPaymentMode === 'FULL'),
    platformFeeBps,
    platformFeeExamplePence:
      platformFeeBps === null ? null : calculatePlatformFeePence(BOOKING_DEPOSIT_PENCE, platformFeeBps),
    canManagePayouts,
    connect: {
      accountId: canManagePayouts ? connect.accountId : null,
      accountLinked: Boolean(connect.accountId) && !connect.disconnectedAt,
      accountType: connect.accountType,
      chargesEnabled: connect.chargesEnabled,
      detailsSubmitted: connect.detailsSubmitted,
      disconnected: Boolean(connect.disconnectedAt),
      disconnectedAt: connect.disconnectedAt?.toISOString() ?? null,
    },
    policy: {
      cancellationWindowHours: shop.cancellationWindowHours,
      rescheduleWindowHours: shop.rescheduleWindowHours,
      maxClientReschedules: shop.maxClientReschedules,
      refundInWindow: true,
      forfeitOutsideWindowOrNoShow: true,
      shopCancelRefunds: true,
      fullPaymentRetainedOnLateCancelOrNoShowPence: FULL_PAYMENT_RETAINED_CAP_PENCE,
    },
  });
};

type ModeRequest =
  | { ok: true; mode: BookingPaymentMode; legacy: boolean }
  | { ok: false; response: Response };

function parseModeRequest(body: { bookingPaymentMode?: unknown; depositsEnabled?: unknown } | null): ModeRequest {
  if (body && body.bookingPaymentMode !== undefined) {
    if (
      body.bookingPaymentMode === 'NONE' ||
      body.bookingPaymentMode === 'DEPOSIT' ||
      body.bookingPaymentMode === 'FULL'
    ) {
      return { ok: true, mode: body.bookingPaymentMode, legacy: false };
    }
    return { ok: false, response: json({ error: 'bookingPaymentMode must be NONE, DEPOSIT or FULL.' }, 400) };
  }
  if (body && typeof body.depositsEnabled === 'boolean') {
    return { ok: true, mode: bookingPaymentModeForLegacyDepositToggle(body.depositsEnabled), legacy: true };
  }
  return {
    ok: false,
    response: json(
      { error: 'bookingPaymentMode (NONE, DEPOSIT or FULL) or depositsEnabled boolean required.' },
      400,
    ),
  };
}

/**
 * Set the booking payment mode (NONE / DEPOSIT / FULL). Owner / billing.manage only.
 * Legacy `{ depositsEnabled }` payloads map false → NONE, true → DEPOSIT and can never
 * overwrite an existing FULL mode — only an explicit `bookingPaymentMode` may leave FULL.
 */
export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  const body = (await ctx.request.json().catch(() => null)) as {
    bookingPaymentMode?: unknown;
    depositsEnabled?: unknown;
  } | null;
  const parsed = parseModeRequest(body);
  if (!parsed.ok) return parsed.response;
  const bookingPaymentMode = parsed.mode;
  const requiresOnlinePayment = bookingPaymentMode === 'DEPOSIT' || bookingPaymentMode === 'FULL';

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);

  if (requiresOnlinePayment) {
    const kersivoAccess = await loadKersivoAccess(shop.id);
    const gate = evaluateBookingPayments({ shop, access: kersivoAccess });
    if (gate.reason === 'demo_shop' || gate.reason === 'no_booking_payments_capability') {
      return json(
        {
          error: 'Online booking payments are available once KERSIVO Starter or Full KERSIVO is active.',
          code: BOOKING_PAYMENTS_NOT_AVAILABLE,
        },
        403,
      );
    }
    if (!gate.ok) {
      return json(
        {
          error: 'Connect Stripe and finish onboarding before requiring online payments.',
          code: BOOKING_PAYMENT_NOT_READY,
        },
        400,
      );
    }
  }

  // depositsEnabled is kept in sync (only DEPOSIT ⇔ true) in the same UPDATE. Legacy toggle
  // requests are guarded so a stale/legacy client can never overwrite a FULL mode.
  const depositsEnabled = bookingPaymentMode === 'DEPOSIT';
  const result = await prisma.shopSettings.updateMany({
    where: parsed.legacy ? { id: shop.id, bookingPaymentMode: { not: 'FULL' } } : { id: shop.id },
    data: { depositsEnabled, bookingPaymentMode },
  });
  if (result.count === 0) {
    if (!parsed.legacy) return json({ error: 'Shop not found.' }, 404);
    return json(
      {
        error: 'Full upfront payment is enabled. Change the booking payment mode instead of the deposit toggle.',
        code: 'booking_payment_mode_full',
      },
      409,
    );
  }

  return json({ depositsEnabled, bookingPaymentMode });
};

/**
 * Start or continue Stripe Connect onboarding for booking payments.
 * New connections use Standard accounts; an existing legacy Express account remains supported
 * until an explicit migration/cutover is performed. Owner / billing.manage only.
 */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectAccountType: true,
      stripeConnectDisconnectedAt: true,
      owner: { select: { email: true } },
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);
  const kersivoAccess = await loadKersivoAccess(shop.id);
  if (!canStartBookingPaymentsOnboarding({ shopId: shop.id, access: kersivoAccess })) {
    return json(
      {
        error: 'Connect Stripe after activating KERSIVO Starter or Full KERSIVO.',
        code: BOOKING_PAYMENTS_NOT_AVAILABLE,
      },
      403,
    );
  }

  let accountId = shop.stripeConnectAccountId;
  let accountType = shop.stripeConnectAccountType;
  const mustCreateStandard = !accountId || Boolean(shop.stripeConnectDisconnectedAt);

  if (mustCreateStandard) {
    const created = await createConnectStandardAccount({
      shopId: shop.id,
      email: shop.owner?.email ?? undefined,
    });
    accountId = created.id;
    accountType = 'STANDARD';
    await prisma.shopSettings.update({
      where: { id: shop.id },
      data: {
        stripeConnectAccountId: accountId,
        stripeConnectAccountType: 'STANDARD',
        stripeConnectChargesEnabled: false,
        stripeConnectDetailsSubmitted: false,
        stripeConnectDisconnectedAt: null,
        connectStatusEventAt: null,
      },
    });
  }

  const base = getPublicSiteUrl();
  // Settings live as an AdminPanel section — not a standalone /admin/barbershop-settings page.
  const link = await createConnectAccountLink({
    accountId,
    refreshUrl: `${base}/admin?section=barbershop_settings&connect=refresh`,
    returnUrl: `${base}/admin?section=barbershop_settings&connect=return`,
  });

  return json({
    url: link.url,
    accountId,
    accountType,
    legacyExpress: accountType === 'EXPRESS',
  });
};
