import { describe, expect, it } from 'vitest';
import { computeClientStats } from './index';

function booking(input: {
  status: string;
  startAt: string;
  endAt: string;
  totalPricePence?: number | null;
  serviceNameAtBooking?: string | null;
}) {
  return {
    status: input.status,
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    updatedAt: new Date(input.startAt),
    paymentRequired: false,
    paymentStatus: null,
    totalPricePence: input.totalPricePence ?? null,
    serviceNameAtBooking: input.serviceNameAtBooking ?? null,
    service: { name: input.serviceNameAtBooking ?? 'Service' },
  };
}

describe('computeClientStats', () => {
  it('treats past BOOKED bookings as completed for stats', () => {
    const nowMs = Date.parse('2026-06-01T15:00:00.000Z');
    const rows = [
      booking({
        status: 'BOOKED',
        startAt: '2026-06-01T13:00:00.000Z',
        endAt: '2026-06-01T13:45:00.000Z',
        totalPricePence: 3000,
        serviceNameAtBooking: 'Fade',
      }),
      booking({
        status: 'BOOKED',
        startAt: '2026-06-01T14:00:00.000Z',
        endAt: '2026-06-01T14:30:00.000Z',
        totalPricePence: 2500,
        serviceNameAtBooking: 'Fade',
      }),
      booking({
        status: 'NO_SHOW',
        startAt: '2026-06-01T12:00:00.000Z',
        endAt: '2026-06-01T12:30:00.000Z',
        totalPricePence: 4000,
        serviceNameAtBooking: 'Beard',
      }),
    ];

    const stats = computeClientStats(rows, nowMs);
    expect(stats.completedCount).toBe(2);
    expect(stats.noShowCount).toBe(1);
    expect(stats.totalSpentPence).toBe(5500);
    expect(stats.avgSpendPence).toBe(2750);
    expect(stats.favouriteService).toBe('Fade');
    expect(stats.lastVisitAt?.toISOString()).toBe('2026-06-01T14:00:00.000Z');
  });
});
