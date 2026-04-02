import { describe, expect, it } from 'vitest';
import { countBookingsByStatusTone, getBookingStatusTone } from './bookingStatus';

describe('countBookingsByStatusTone', () => {
  it('matches getBookingStatusTone per booking and sums to length', () => {
    const bookings = [
      { status: 'CONFIRMED' },
      { status: 'CONFIRMED', rescheduledAt: '2026-01-01T10:00:00.000Z' },
      { status: 'PENDING_CONFIRMATION' },
      { status: 'EXPIRED' },
      { status: 'CANCELLED_BY_CLIENT' },
      { status: 'CANCELLED_BY_SHOP' },
      { status: 'RESCHEDULED' },
      { status: 'UNKNOWN_FUTURE', rescheduledAt: null },
    ];
    const counts = countBookingsByStatusTone(bookings);
    for (const b of bookings) {
      expect(counts[getBookingStatusTone(b)]).toBeGreaterThanOrEqual(1);
    }
    expect(counts.confirmed + counts.pending + counts.cancelled + counts.rescheduled).toBe(bookings.length);
    expect(counts.confirmed).toBe(1);
    expect(counts.pending).toBe(3);
    expect(counts.cancelled).toBe(2);
    expect(counts.rescheduled).toBe(2);
  });

  it('returns zeros for empty input', () => {
    expect(countBookingsByStatusTone([])).toEqual({
      confirmed: 0,
      pending: 0,
      cancelled: 0,
      rescheduled: 0,
    });
  });
});
