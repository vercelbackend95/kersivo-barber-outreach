import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';

import { getDemoBookingsHistoryResponse, getDemoBookingsStatsResponse } from './bookings';
import { DEMO_BARBER_IDS } from './ids';

const TZ = 'Europe/London';

describe('getDemoBookingsHistoryResponse', () => {
  it('paginates with hasMore and cursor', () => {
    const page1 = getDemoBookingsHistoryResponse(new URLSearchParams({ limit: '10' }));
    expect(page1.bookings).toHaveLength(10);
    expect(page1.hasMore).toBe(true);
    expect(page1.cursor).toBeTruthy();

    const page2 = getDemoBookingsHistoryResponse(
      new URLSearchParams({ limit: '10', cursor: page1.cursor! }),
    );
    expect(page2.bookings).toHaveLength(10);
    expect(page2.bookings[0]?.id).not.toBe(page1.bookings[0]?.id);
  });

  it('filters by barberId', () => {
    const mixed = getDemoBookingsHistoryResponse(new URLSearchParams({ limit: '50' }));
    const jamie = getDemoBookingsHistoryResponse(
      new URLSearchParams({ barberId: DEMO_BARBER_IDS.jamie, limit: '50' }),
    );
    expect(jamie.bookings.length).toBeGreaterThan(0);
    expect(jamie.bookings.every((row) => row.barberId === DEMO_BARBER_IDS.jamie)).toBe(true);
    expect(mixed.bookings.some((row) => row.barberId !== DEMO_BARBER_IDS.jamie)).toBe(true);
  });

  it('filters by from/to date range', () => {
    const empty = getDemoBookingsHistoryResponse(
      new URLSearchParams({ from: '2020-01-01', to: '2020-01-02', limit: '100' }),
    );
    expect(empty.bookings).toHaveLength(0);

    const sample = getDemoBookingsHistoryResponse(new URLSearchParams({ limit: '1' })).bookings[0];
    expect(sample).toBeTruthy();
    const dayKey = formatInTimeZone(new Date(sample!.startAt), TZ, 'yyyy-MM-dd');
    const day = getDemoBookingsHistoryResponse(
      new URLSearchParams({ from: dayKey, to: dayKey, limit: '100' }),
    );
    expect(day.bookings.length).toBeGreaterThan(0);
    expect(
      day.bookings.every(
        (row) => formatInTimeZone(new Date(row.startAt), TZ, 'yyyy-MM-dd') === dayKey,
      ),
    ).toBe(true);
  });
});

describe('getDemoBookingsStatsResponse', () => {
  it('scopes completed count by barberId', () => {
    const all = getDemoBookingsStatsResponse(new URLSearchParams());
    const jamie = getDemoBookingsStatsResponse(
      new URLSearchParams({ barberId: DEMO_BARBER_IDS.jamie }),
    );
    expect(all.totalBookingsServed).toBeGreaterThan(0);
    expect(jamie.totalBookingsServed).toBeGreaterThan(0);
    expect(jamie.totalBookingsServed).toBeLessThanOrEqual(all.totalBookingsServed);
  });
});
