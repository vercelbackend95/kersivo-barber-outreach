import { describe, expect, it } from 'vitest';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { getUpcomingBookings } from './AdminTodayBookingsLiveProvider';
import { getDemoBookingsResponse } from '@/lib/admin/demoFixtures/bookings';

const TZ = 'Europe/London';

describe('AdminTodayBookingsLiveProvider demo strip', () => {
  it('yields upcoming appointments from demo bookings fixture (morning pin)', () => {
    const dayKey = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const morningMs = fromZonedTime(`${dayKey}T08:00:00`, TZ).getTime();
    const { bookings } = getDemoBookingsResponse(
      new URLSearchParams({ date: dayKey, mode: 'day' }),
    );
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings.every((row) => row.status === 'BOOKED')).toBe(true);

    const upcoming = getUpcomingBookings(bookings, morningMs).slice(0, 4);
    expect(upcoming.length).toBeGreaterThan(0);
  });

  it('falls back to tomorrow when today has no remaining slots (evening pin)', () => {
    const todayKey = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const [y, m, d] = todayKey.split('-').map(Number);
    const tomorrowKey = formatInTimeZone(
      new Date(Date.UTC(y!, m! - 1, d! + 1, 12, 0, 0)),
      TZ,
      'yyyy-MM-dd',
    );
    const eveningMs = fromZonedTime(`${todayKey}T22:00:00`, TZ).getTime();

    const today = getDemoBookingsResponse(new URLSearchParams({ date: todayKey })).bookings;
    const tomorrow = getDemoBookingsResponse(new URLSearchParams({ date: tomorrowKey })).bookings;
    expect(getUpcomingBookings(today, eveningMs)).toHaveLength(0);

    const merged = getUpcomingBookings([...today, ...tomorrow], eveningMs).slice(0, 4);
    expect(merged.length).toBeGreaterThan(0);
    expect(
      merged.every(
        (row) => formatInTimeZone(new Date(row.startAt), TZ, 'yyyy-MM-dd') === tomorrowKey,
      ),
    ).toBe(true);
  });
});
