import { getEffectiveBookingStatus } from './operationalStatus';

/** Stored statuses that can still be operational; everything else is terminal history. */
export const OPERATIONAL_BOOKING_CANDIDATE_STATUSES = [
  'BOOKED',
  'PENDING_PAYMENT',
  'ARRIVED',
  'IN_PROGRESS',
] as const;

/**
 * True while a booking still needs live handling (customer identity, comms, payment, refunds):
 * an in-flight payment, a client on site / in the chair, or an upcoming BOOKED appointment.
 * Reuses getEffectiveBookingStatus for BOOKED clock semantics.
 */
export function isOperationalBooking(input: {
  status: string;
  startAt: Date;
  endAt: Date;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  if (input.status === 'PENDING_PAYMENT') return true;
  if (input.status === 'ARRIVED' || input.status === 'IN_PROGRESS') return true;

  const effective = getEffectiveBookingStatus({
    status: input.status,
    startAt: input.startAt,
    endAt: input.endAt,
    nowMs,
  });

  if (effective === 'IN_PROGRESS') return true;
  if (effective === 'BOOKED' && input.startAt.getTime() > nowMs) return true;
  return false;
}
