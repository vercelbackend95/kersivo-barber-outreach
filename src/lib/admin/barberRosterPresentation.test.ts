import { describe, expect, it } from 'vitest';
import {
  bookingDurationHours,
  getDayFillForRange,
  ESTIMATED_BOOKING_DURATION_H,
  WORKING_HOURS_PER_DAY,
  type BarberBookingPreview,
} from './barberRosterPresentation';

function preview(p: Partial<BarberBookingPreview> & Pick<BarberBookingPreview, 'barberId' | 'startAt' | 'status'>): BarberBookingPreview {
  return {
    service: null,
    ...p,
  };
}

describe('bookingDurationHours', () => {
  it('uses endAt minus startAt when valid', () => {
    const b = preview({
      barberId: 'a',
      status: 'CONFIRMED',
      startAt: '2026-06-15T10:00:00.000Z',
      endAt: '2026-06-15T10:45:00.000Z',
    });
    expect(bookingDurationHours(b)).toBe(0.75);
  });

  it('falls back when endAt is missing', () => {
    const b = preview({
      barberId: 'a',
      status: 'CONFIRMED',
      startAt: '2026-06-15T10:00:00.000Z',
    });
    expect(bookingDurationHours(b)).toBe(ESTIMATED_BOOKING_DURATION_H);
  });

  it('falls back when endAt is not after startAt', () => {
    const b = preview({
      barberId: 'a',
      status: 'CONFIRMED',
      startAt: '2026-06-15T10:00:00.000Z',
      endAt: '2026-06-15T10:00:00.000Z',
    });
    expect(bookingDurationHours(b)).toBe(ESTIMATED_BOOKING_DURATION_H);
  });
});

describe('getDayFillForRange', () => {
  const dayStart = Date.UTC(2026, 5, 15, 0, 0, 0, 0);
  const dayEnd = Date.UTC(2026, 5, 15, 23, 59, 59, 999);

  it('sums real slot lengths for the barber that day', () => {
    const bookings: BarberBookingPreview[] = [
      preview({
        barberId: 'b1',
        status: 'CONFIRMED',
        startAt: new Date(Date.UTC(2026, 5, 15, 9, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 5, 15, 10, 0)).toISOString(),
      }),
      preview({
        barberId: 'b1',
        status: 'CONFIRMED',
        startAt: new Date(Date.UTC(2026, 5, 15, 11, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 5, 15, 11, 30)).toISOString(),
      }),
    ];
    const fill = getDayFillForRange(bookings, 'b1', dayStart, dayEnd);
    expect(fill.count).toBe(2);
    expect(fill.bookedHoursH).toBe(1.5);
    expect(fill.workingH).toBe(WORKING_HOURS_PER_DAY);
    expect(fill.pct).toBe(19);
  });

  it('ignores other barbers', () => {
    const bookings: BarberBookingPreview[] = [
      preview({
        barberId: 'b1',
        status: 'CONFIRMED',
        startAt: new Date(Date.UTC(2026, 5, 15, 9, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 5, 15, 10, 0)).toISOString(),
      }),
      preview({
        barberId: 'b2',
        status: 'CONFIRMED',
        startAt: new Date(Date.UTC(2026, 5, 15, 9, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 5, 15, 12, 0)).toISOString(),
      }),
    ];
    const fill = getDayFillForRange(bookings, 'b1', dayStart, dayEnd);
    expect(fill.bookedHoursH).toBe(1);
    expect(fill.pct).toBe(13);
  });
});
