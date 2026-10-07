import { hasKersivoCapability, loadKersivoAccess } from '@/lib/shop/kersivoAccess';
import {
  loadStarterPublicLaunchReadiness,
  type StarterPublicLaunchPauseReason,
  type StarterPublicLaunchReadiness,
} from './starterPublicLaunchReadiness';

export type PublicBookingIntakeReason =
  | 'ok'
  | 'no_public_booking_entitlement'
  | 'shop_missing'
  | StarterPublicLaunchPauseReason;

export type PublicBookingIntakeStatus = {
  accepting: boolean;
  /** Internal/admin only — customers only ever see a generic "temporarily unavailable". */
  reason: PublicBookingIntakeReason;
  starterReadiness: StarterPublicLaunchReadiness | null;
};

/**
 * Whether a shop may accept NEW public online bookings, and why not.
 *
 * v1.19 Starter adds a launch/runtime readiness layer on top of entitlement:
 * - PUBLIC_BOOKING entitlement must still exist;
 * - Stripe Connect must be payment-ready;
 * - at least one active service must exist;
 * - no active Starter service may be priced below £5.
 * A Starter shop failing readiness (e.g. after Full → Starter or the v1.18 cutover) keeps its
 * entitlement, dashboard and accepted bookings; only new public intake pauses.
 *
 * Full keeps its existing entitlement behaviour here. Its payment mode remains authoritative
 * inside booking creation: online-payment modes fail closed when Stripe is unavailable, while
 * Full Pay-at-shop may continue without Stripe.
 */
export async function loadPublicBookingIntakeStatus(shopId: string): Promise<PublicBookingIntakeStatus> {
  const access = await loadKersivoAccess(shopId);
  if (!hasKersivoCapability(access, 'PUBLIC_BOOKING')) {
    return { accepting: false, reason: 'no_public_booking_entitlement', starterReadiness: null };
  }
  if (access.state !== 'FREE_BOOKING') {
    return { accepting: true, reason: 'ok', starterReadiness: null };
  }

  const readiness = await loadStarterPublicLaunchReadiness(shopId);
  if (!readiness) return { accepting: false, reason: 'shop_missing', starterReadiness: null };
  if (!readiness.ready) {
    return { accepting: false, reason: readiness.reasons[0], starterReadiness: readiness };
  }
  return { accepting: true, reason: 'ok', starterReadiness: readiness };
}

export async function shopAcceptsPublicBookings(shopId: string): Promise<boolean> {
  return (await loadPublicBookingIntakeStatus(shopId)).accepting;
}
