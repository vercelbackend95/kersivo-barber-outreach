import { describe, expect, it } from 'vitest';
import { getBookingPaymentChipState, isBookingPaidQualified } from './paymentReporting';

describe('payment reporting rules', () => {
  const startAt = '2026-06-01T10:00:00.000Z';
  const endAt = '2026-06-01T10:45:00.000Z';

  it('treats explicit PAID as paid-qualified', () => {
    expect(
      isBookingPaidQualified({
        status: 'BOOKED',
        startAt,
        endAt,
        paymentStatus: 'PAID',
        nowMs: Date.parse('2026-06-01T09:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('treats completed-effective bookings as paid-qualified', () => {
    expect(
      isBookingPaidQualified({
        status: 'BOOKED',
        startAt,
        endAt,
        paymentStatus: null,
        nowMs: Date.parse('2026-06-01T11:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('keeps future unpaid bookings as unpaid-qualified false', () => {
    expect(
      isBookingPaidQualified({
        status: 'BOOKED',
        startAt,
        endAt,
        paymentStatus: null,
        nowMs: Date.parse('2026-06-01T09:30:00.000Z'),
      }),
    ).toBe(false);
  });

  it('returns payment chip state from same shared rule', () => {
    expect(
      getBookingPaymentChipState({
        status: 'BOOKED',
        startAt,
        endAt,
        paymentStatus: null,
        nowMs: Date.parse('2026-06-01T09:30:00.000Z'),
      }),
    ).toBe('unpaid');

    expect(
      getBookingPaymentChipState({
        status: 'BOOKED',
        startAt,
        endAt,
        paymentStatus: null,
        nowMs: Date.parse('2026-06-01T11:30:00.000Z'),
      }),
    ).toBe('paid');
  });
});
