export const prerender = false;

import type { APIRoute } from 'astro';
import { Prisma, type BookingPaymentMode } from '@prisma/client';
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
  STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE,
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
import { isStarterStripeAccountType } from '@/lib/setup/starterPublicLaunchReadiness';
import {
  ACCOUNT_LIFECYCLE_ACTIONS,
  recordAccountLifecycleEvent,
} from '@/lib/setup/accountLifecycleAudit';

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
      stripeConnectDisconnectedAt: connect.disconnectedAt,
    },
    access: kersivoAccess,
  });
  const platformFeeBps = kersivoPlatformFeeBps(kersivoAccess.state);
  const starterRequiresStandard =
    kersivoAccess.state === 'FREE_BOOKING' &&
    Boolean(connect.accountId) &&
    !connect.disconnectedAt &&
    !isStarterStripeAccountType(connect.accountType);
  const bookingPaymentsReady = gate.ok && !starterRequiresStandard;

  return json({
    /** Paid (FULL_KERSIVO) entitlement — Retail stays Full-only. */
    paid: isPaidShop(shop),
    productState: kersivoAccess.state,
    bookingPaymentMode: shop.bookingPaymentMode,
    effectiveBookingPaymentPolicy:
      kersivoAccess.state === 'FREE_BOOKING' ? 'STARTER_FIXED' : shop.bookingPaymentMode,
    paymentControlsEditable: kersivoAccess.state === 'FULL_KERSIVO',
    starterPaymentPolicy:
      kersivoAccess.state === 'FREE_BOOKING'
        ? {
            minimumOnlinePaymentPence: STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE,
            payInFullAvailable: true,
            publicPayAtShop: false,
          }
        : null,
    depositsEnabled: shop.depositsEnabled,
    depositAmountPence: BOOKING_DEPOSIT_PENCE,
    bookingPaymentsAvailable: canStartBookingPaymentsOnboarding({
      shopId: shop.id,
      access: kersivoAccess,
    }),
    bookingPaymentsReady,
    bookingPaymentsGateReason: starterRequiresStandard ? 'connect_requires_standard' : gate.reason,
    starterRequiresStandard,
    collectReady:
      bookingPaymentsReady &&
      (kersivoAccess.state === 'FREE_BOOKING' ||
        shop.bookingPaymentMode === 'DEPOSIT' ||
        shop.bookingPaymentMode === 'FULL'),
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

  const productAccess = await loadKersivoAccess(access.shopId);
  if (productAccess.state !== 'FULL_KERSIVO') {
    return json(
      {
        error: 'Booking payment controls are available with Full KERSIVO.',
        code: 'STARTER_PAYMENT_SETTINGS_READ_ONLY',
      },
      403,
    );
  }

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
 * Moves a Starter shop off a still-connected legacy (non-Standard) account onto a new Standard
 * account. Paid bookings created before payment-account snapshots existed resolve their Stripe
 * account from the shop's CURRENT account, so they are pinned to the legacy account first: only
 * missing snapshots are filled (never overwritten), and only on rows that touched Stripe and carry
 * no KERSIVO fee — exactly the rows whose refunds would otherwise follow the new account.
 * Returns null when the shop's account changed concurrently.
 */
async function switchStarterToStandardAccount(input: {
  shopId: string;
  legacyAccountId: string;
  standardAccountId: string;
}): Promise<{ pinnedLegacyBookings: number } | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${input.shopId} FOR UPDATE`);
    const current = await tx.shopSettings.findUnique({
      where: { id: input.shopId },
      select: { stripeConnectAccountId: true, stripeConnectDisconnectedAt: true },
    });
    if (
      current?.stripeConnectAccountId?.trim() !== input.legacyAccountId ||
      current.stripeConnectDisconnectedAt
    ) {
      return null;
    }

    const pinned = await tx.booking.updateMany({
      where: {
        barber: { is: { shopId: input.shopId } },
        stripeConnectAccountIdAtPayment: null,
        OR: [{ stripePaymentIntentId: { not: null } }, { stripeCheckoutSessionId: { not: null } }],
        AND: [{ OR: [{ kersivoPlatformFeePence: null }, { kersivoPlatformFeePence: 0 }] }],
      },
      data: { stripeConnectAccountIdAtPayment: input.legacyAccountId },
    });

    await tx.shopSettings.update({
      where: { id: input.shopId },
      data: {
        stripeConnectAccountId: input.standardAccountId,
        stripeConnectAccountType: 'STANDARD',
        stripeConnectChargesEnabled: false,
        stripeConnectDetailsSubmitted: false,
        stripeConnectDisconnectedAt: null,
        connectStatusEventAt: null,
      },
    });
    return { pinnedLegacyBookings: pinned.count };
  });
}

/**
 * Start or continue Stripe Connect onboarding for booking payments.
 * New connections use Standard accounts. Full KERSIVO keeps an existing legacy Express account;
 * a Starter shop on a legacy (non-Standard) account is moved to a new Standard account because
 * v1.19 Starter public bookings require Standard. Owner / billing.manage only.
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
  const legacyStarterAccountId =
    kersivoAccess.state === 'FREE_BOOKING' &&
    !shop.stripeConnectDisconnectedAt &&
    !isStarterStripeAccountType(accountType)
      ? accountId?.trim() || null
      : null;
  const mustCreateStandard =
    !accountId || Boolean(shop.stripeConnectDisconnectedAt) || Boolean(legacyStarterAccountId);

  if (mustCreateStandard) {
    const created = await createConnectStandardAccount({
      shopId: shop.id,
      email: shop.owner?.email ?? undefined,
    });
    accountId = created.id;

    if (legacyStarterAccountId) {
      const switched = await switchStarterToStandardAccount({
        shopId: shop.id,
        legacyAccountId: legacyStarterAccountId,
        standardAccountId: created.id,
      });
      if (!switched) {
        return json({ error: 'Your Stripe connection changed. Refresh and try again.' }, 409);
      }
      await recordAccountLifecycleEvent({
        action: ACCOUNT_LIFECYCLE_ACTIONS.STARTER_STRIPE_STANDARD_SWITCHED,
        userId: access.userId,
        shopId: shop.id,
        meta: {
          legacyAccountId: legacyStarterAccountId,
          legacyAccountType: accountType ?? null,
          standardAccountId: created.id,
          pinnedLegacyBookings: switched.pinnedLegacyBookings,
        },
      });
    } else {
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
    accountType = 'STANDARD';
  }

  const resolvedAccountId = accountId?.trim();
  if (!resolvedAccountId) {
    return json({ error: 'Stripe Connect account is unavailable.' }, 500);
  }

  const base = getPublicSiteUrl();
  // Settings live as an AdminPanel section — not a standalone /admin/barbershop-settings page.
  const link = await createConnectAccountLink({
    accountId: resolvedAccountId,
    refreshUrl: `${base}/admin?section=barbershop_settings&connect=refresh`,
    returnUrl: `${base}/admin?section=barbershop_settings&connect=return`,
  });

  return json({
    url: link.url,
    accountId: resolvedAccountId,
    accountType,
    legacyExpress: accountType === 'EXPRESS',
  });
};
