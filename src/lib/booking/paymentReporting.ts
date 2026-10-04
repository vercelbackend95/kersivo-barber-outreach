import { getEffectiveBookingStatus } from './operationalStatus';

type PaymentRuleInput = {
  status: string;
  startAt: Date | string;
  endAt: Date | string;
  paymentStatus?: string | null;
  nowMs?: number;
};

/** Online payment was taken; a partial refund does not undo that. */
const PAID_ONLINE_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED']);

export function isBookingPaidQualified(input: PaymentRuleInput): boolean {
  if (input.paymentStatus && PAID_ONLINE_STATUSES.has(input.paymentStatus)) return true;
  const effectiveStatus = getEffectiveBookingStatus({
    status: input.status,
    startAt: input.startAt,
    endAt: input.endAt,
    nowMs: input.nowMs,
  });
  return effectiveStatus === 'COMPLETED';
}

export function getBookingPaymentChipState(input: PaymentRuleInput): 'paid' | 'unpaid' {
  return isBookingPaidQualified(input) ? 'paid' : 'unpaid';
}
