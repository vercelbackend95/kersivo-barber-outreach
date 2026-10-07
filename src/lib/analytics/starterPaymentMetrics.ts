export type BookingPaymentAnalyticsRow = {
  kersivoProductStateAtBooking?: string | null;
  bookingPaymentType?: string | null;
  paymentAmountPence?: number | null;
  paidAt?: Date | string | null;
};

export type BookingPaymentAnalyticsSummary = {
  onlineCardPaymentVolumePence: number;
  starterOnlineCardVolumePence: number;
  fullOnlineCardVolumePence: number;
  starterMinimumPaymentFloorVolumePence: number;
  starterDepositVolumePence: number;
  starterFullPaymentVolumePence: number;
  starterPaidBookingCount: number;
  starterDepositBookingCount: number;
  starterFullPaymentBookingCount: number;
  /** Fraction 0..1. Null when no paid Starter public booking exists. */
  starterFullPaymentTakeRate: number | null;
};

const STARTER_STATE = 'FREE_BOOKING';
const FULL_STATE = 'FULL_KERSIVO';
const STARTER_MINIMUM_PAYMENT_PENCE = 500;

function paidAmount(row: BookingPaymentAnalyticsRow): number {
  if (!row.paidAt) return 0;
  const amount = Math.trunc(row.paymentAmountPence ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/**
 * Gross online-payment analytics. A later refund does not erase gross payment volume;
 * paidAt is the durable proof that the booking payment was captured.
 *
 * Historical rows without kersivoProductStateAtBooking remain in total online-card volume
 * but are intentionally excluded from Starter/Full attribution rather than guessed.
 */
export function summarizeBookingPaymentAnalytics(
  rows: readonly BookingPaymentAnalyticsRow[],
): BookingPaymentAnalyticsSummary {
  let onlineCardPaymentVolumePence = 0;
  let starterOnlineCardVolumePence = 0;
  let fullOnlineCardVolumePence = 0;
  let starterMinimumPaymentFloorVolumePence = 0;
  let starterDepositVolumePence = 0;
  let starterFullPaymentVolumePence = 0;
  let starterPaidBookingCount = 0;
  let starterDepositBookingCount = 0;
  let starterFullPaymentBookingCount = 0;

  for (const row of rows) {
    const amount = paidAmount(row);
    if (amount <= 0) continue;

    onlineCardPaymentVolumePence += amount;

    if (row.kersivoProductStateAtBooking === STARTER_STATE) {
      starterOnlineCardVolumePence += amount;
      starterMinimumPaymentFloorVolumePence += Math.min(
        amount,
        STARTER_MINIMUM_PAYMENT_PENCE,
      );
      starterPaidBookingCount += 1;

      if (row.bookingPaymentType === 'DEPOSIT') {
        starterDepositVolumePence += amount;
        starterDepositBookingCount += 1;
      } else if (row.bookingPaymentType === 'FULL') {
        starterFullPaymentVolumePence += amount;
        starterFullPaymentBookingCount += 1;
      }
    } else if (row.kersivoProductStateAtBooking === FULL_STATE) {
      fullOnlineCardVolumePence += amount;
    }
  }

  return {
    onlineCardPaymentVolumePence,
    starterOnlineCardVolumePence,
    fullOnlineCardVolumePence,
    starterMinimumPaymentFloorVolumePence,
    starterDepositVolumePence,
    starterFullPaymentVolumePence,
    starterPaidBookingCount,
    starterDepositBookingCount,
    starterFullPaymentBookingCount,
    starterFullPaymentTakeRate:
      starterPaidBookingCount > 0
        ? starterFullPaymentBookingCount / starterPaidBookingCount
        : null,
  };
}
