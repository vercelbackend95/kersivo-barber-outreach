import { describe, expect, it } from 'vitest';
import { summarizeBookingPaymentAnalytics } from './starterPaymentMetrics';

describe('summarizeBookingPaymentAnalytics', () => {
  it('separates Starter deposit/full volume and Full volume using immutable product snapshots', () => {
    const result = summarizeBookingPaymentAnalytics([
      {
        kersivoProductStateAtBooking: 'FREE_BOOKING',
        bookingPaymentType: 'DEPOSIT',
        paymentAmountPence: 500,
        paidAt: new Date('2026-10-06T10:00:00Z'),
      },
      {
        kersivoProductStateAtBooking: 'FREE_BOOKING',
        bookingPaymentType: 'FULL',
        paymentAmountPence: 2500,
        paidAt: new Date('2026-10-06T11:00:00Z'),
      },
      {
        kersivoProductStateAtBooking: 'FREE_BOOKING',
        bookingPaymentType: 'FULL',
        paymentAmountPence: 500,
        paidAt: new Date('2026-10-06T12:00:00Z'),
      },
      {
        kersivoProductStateAtBooking: 'FULL_KERSIVO',
        bookingPaymentType: 'FULL',
        paymentAmountPence: 3000,
        paidAt: new Date('2026-10-06T13:00:00Z'),
      },
    ]);

    expect(result).toEqual({
      onlineCardPaymentVolumePence: 6500,
      starterOnlineCardVolumePence: 3500,
      fullOnlineCardVolumePence: 3000,
      starterMinimumPaymentFloorVolumePence: 1500,
      starterDepositVolumePence: 500,
      starterFullPaymentVolumePence: 3000,
      starterPaidBookingCount: 3,
      starterDepositBookingCount: 1,
      starterFullPaymentBookingCount: 2,
      starterFullPaymentTakeRate: 2 / 3,
    });
  });

  it('keeps historical paid rows in total GMV but does not guess Starter/Full attribution', () => {
    const result = summarizeBookingPaymentAnalytics([
      {
        kersivoProductStateAtBooking: null,
        bookingPaymentType: 'DEPOSIT',
        paymentAmountPence: 500,
        paidAt: new Date('2026-09-01T10:00:00Z'),
      },
    ]);

    expect(result.onlineCardPaymentVolumePence).toBe(500);
    expect(result.starterOnlineCardVolumePence).toBe(0);
    expect(result.fullOnlineCardVolumePence).toBe(0);
    expect(result.starterFullPaymentTakeRate).toBeNull();
  });

  it('ignores unpaid holds even when they have a payment amount snapshot', () => {
    const result = summarizeBookingPaymentAnalytics([
      {
        kersivoProductStateAtBooking: 'FREE_BOOKING',
        bookingPaymentType: 'DEPOSIT',
        paymentAmountPence: 500,
        paidAt: null,
      },
    ]);

    expect(result.onlineCardPaymentVolumePence).toBe(0);
    expect(result.starterPaidBookingCount).toBe(0);
    expect(result.starterFullPaymentTakeRate).toBeNull();
  });

  it('counts gross captured volume even if a booking may later be refunded', () => {
    const result = summarizeBookingPaymentAnalytics([
      {
        kersivoProductStateAtBooking: 'FREE_BOOKING',
        bookingPaymentType: 'FULL',
        paymentAmountPence: 2000,
        paidAt: '2026-10-06T10:00:00Z',
      },
    ]);

    expect(result.onlineCardPaymentVolumePence).toBe(2000);
    expect(result.starterFullPaymentVolumePence).toBe(2000);
  });
});
