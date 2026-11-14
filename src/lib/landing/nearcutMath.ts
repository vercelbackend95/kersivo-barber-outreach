/**
 * Pure maths for the /nearcut-alternative estimator. Uses Nearcut's own illustrative booking
 * charge (labelled as an example, never a universal fee) and the flat Full KERSIVO price.
 */
import { requireIllustrativeNearcutFact } from '@/lib/seo/nearcutFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const NEARCUT_EXAMPLE_CHARGE_GBP = requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample').amountGbp;
export const NEARCUT_BOOKINGS_MIN = 40;
export const NEARCUT_BOOKINGS_MAX = 800;
export const NEARCUT_BOOKINGS_DEFAULT = 240;

export type NearcutEstimate = {
  bookings: number;
  /** Booking charges clients would pay in a month at Nearcut's example rate. */
  clientChargesMonthly: number;
  /** Same, over a year. */
  clientChargesYearly: number;
  /** KERSIVO booking charges on clients: always zero. */
  kersivoClientCharges: 0;
  /** Full KERSIVO subscription, flat whatever the booking count. */
  kersivoMonthly: number;
};

export function clampBookings(value: number): number {
  if (!Number.isFinite(value)) return NEARCUT_BOOKINGS_DEFAULT;
  return Math.min(NEARCUT_BOOKINGS_MAX, Math.max(NEARCUT_BOOKINGS_MIN, Math.round(value)));
}

export function estimateNearcutClientCharges(bookings: number): NearcutEstimate {
  const n = clampBookings(bookings);
  const monthly = Math.round(n * NEARCUT_EXAMPLE_CHARGE_GBP * 100) / 100;
  return {
    bookings: n,
    clientChargesMonthly: monthly,
    clientChargesYearly: Math.round(monthly * 12 * 100) / 100,
    kersivoClientCharges: 0,
    kersivoMonthly: SAAS_MONTHLY_GBP,
  };
}

export function formatGbpWhole(value: number): string {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}
