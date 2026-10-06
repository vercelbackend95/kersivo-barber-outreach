import { prisma } from '@/lib/db/client';
import { STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE } from '@/lib/booking/bookingPaymentPolicy';
import {
  evaluateBookingPayments,
  type BookingPaymentsShopFields,
} from '@/lib/booking/bookingPaymentsGate';
import { accessForState, type KersivoAccessDb } from '@/lib/shop/kersivoAccess';

/**
 * v1.19 Starter public-launch readiness: whether NEW public bookings may be taken under the
 * fixed Starter payment policy. Deliberately separate from product entitlement (kersivoAccess)
 * and RBAC: a Starter shop that is not ready keeps its dashboard, data and accepted bookings;
 * only new public intake pauses.
 *
 * Never mutates anything: services below £5 are reported, not repriced or deactivated.
 */

export type StarterPublicLaunchPauseReason =
  | 'stripe_not_ready'
  | 'no_active_services'
  | 'service_below_minimum';

export type StarterStripeLaunchBlocker =
  | 'connect_missing'
  | 'connect_disconnected'
  | 'connect_requires_standard'
  | 'connect_not_ready';

/**
 * v1.19 Starter public bookings require a Stripe Connect STANDARD account. Legacy EXPRESS (and an
 * unknown/null type) never count as Starter-ready; generic booking-payment readiness still accepts
 * legacy Express for Full KERSIVO and historical payments/refunds.
 */
export function isStarterStripeAccountType(type: string | null | undefined): boolean {
  return String(type ?? '') === 'STANDARD';
}

export type StarterReadinessShopFields = BookingPaymentsShopFields & {
  stripeConnectAccountType: string | null;
};

export type StarterServiceBelowMinimum = {
  id: string;
  name: string;
  pricePence: number;
};

export type StarterPublicLaunchReadiness = {
  ready: boolean;
  reasons: StarterPublicLaunchPauseReason[];
  stripe: {
    ready: boolean;
    accountLinked: boolean;
    disconnected: boolean;
    /** A current (non-disconnected) account exists but is not Standard (legacy Express / unknown). */
    requiresStandard: boolean;
    blocker: StarterStripeLaunchBlocker | null;
  };
  activeServiceCount: number;
  minimumServicePricePence: number;
  servicesBelowMinimum: StarterServiceBelowMinimum[];
};

export type StarterReadinessService = {
  id: string;
  name?: string | null;
  pricePence: number;
  isActive: boolean;
};

/** Pure evaluation under Starter rules, regardless of the shop's current plan (downgrade preview). */
export function evaluateStarterPublicLaunchReadiness(input: {
  shop: StarterReadinessShopFields;
  services: readonly StarterReadinessService[];
}): StarterPublicLaunchReadiness {
  const gate = evaluateBookingPayments({
    shop: input.shop,
    access: accessForState('FREE_BOOKING'),
  });
  const disconnected = Boolean(input.shop.stripeConnectDisconnectedAt);
  const hasAccountId = Boolean(input.shop.stripeConnectAccountId?.trim());
  const accountLinked = hasAccountId && !disconnected;
  const requiresStandard =
    accountLinked && !isStarterStripeAccountType(input.shop.stripeConnectAccountType);
  const stripeReady = gate.ok && !requiresStandard;
  const stripeBlocker: StarterStripeLaunchBlocker | null = stripeReady
    ? null
    : disconnected
      ? 'connect_disconnected'
      : !hasAccountId
        ? 'connect_missing'
        : requiresStandard
          ? 'connect_requires_standard'
          : 'connect_not_ready';

  const activeServices = input.services.filter((service) => service.isActive);
  const servicesBelowMinimum = activeServices
    .filter((service) => service.pricePence < STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE)
    .map((service) => ({
      id: service.id,
      name: service.name?.trim() || 'Untitled service',
      pricePence: service.pricePence,
    }));

  const reasons: StarterPublicLaunchPauseReason[] = [];
  if (stripeBlocker) reasons.push('stripe_not_ready');
  if (activeServices.length === 0) reasons.push('no_active_services');
  if (servicesBelowMinimum.length > 0) reasons.push('service_below_minimum');

  return {
    ready: reasons.length === 0,
    reasons,
    stripe: { ready: stripeReady, accountLinked, disconnected, requiresStandard, blocker: stripeBlocker },
    activeServiceCount: activeServices.length,
    minimumServicePricePence: STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE,
    servicesBelowMinimum,
  };
}

/** Loads current Stripe + active-service state and evaluates Starter readiness. Null if no shop. */
export async function loadStarterPublicLaunchReadiness(
  shopId: string,
  db: KersivoAccessDb = prisma,
): Promise<StarterPublicLaunchReadiness | null> {
  const [shop, services] = await Promise.all([
    db.shopSettings.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectDisconnectedAt: true,
        stripeConnectAccountType: true,
      },
    }),
    db.service.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, pricePence: true, isActive: true },
    }),
  ]);
  if (!shop) return null;
  return evaluateStarterPublicLaunchReadiness({ shop, services });
}
