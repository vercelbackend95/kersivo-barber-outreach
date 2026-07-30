import { describe, expect, it } from 'vitest';

import {
  getDemoBookingsForDayKey,
  getDemoHistoryBookings,
  getSharedDemoDayBookings,
} from './bookingCalendar';

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

describe('getDemoBookingsForDayKey', () => {
  it('is deterministic for the same dayKey', () => {
    const a = getDemoBookingsForDayKey('2026-07-15');
    const b = getDemoBookingsForDayKey('2026-07-15');
    expect(a.map((row) => ({ id: row.id, startAt: row.startAt, status: row.status }))).toEqual(
      b.map((row) => ({ id: row.id, startAt: row.startAt, status: row.status })),
    );
  });

  it('varies ids/times across different dayKeys', () => {
    const a = getDemoBookingsForDayKey('2026-07-15');
    const b = getDemoBookingsForDayKey('2026-07-16');
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    const aSig = a.map((row) => `${row.id}|${row.startAt}`).join(';');
    const bSig = b.map((row) => `${row.id}|${row.startAt}`).join(';');
    expect(aSig).not.toBe(bSig);
  });

  it('has no overlaps per barber', () => {
    for (const dayKey of ['2026-07-15', '2026-07-18', '2026-07-19']) {
      const rows = getDemoBookingsForDayKey(dayKey);
      for (let i = 0; i < rows.length; i += 1) {
        for (let j = i + 1; j < rows.length; j += 1) {
          const a = rows[i]!;
          const b = rows[j]!;
          if (a.barberId !== b.barberId) continue;
          expect(
            overlaps(
              new Date(a.startAt).getTime(),
              new Date(a.endAt).getTime(),
              new Date(b.startAt).getTime(),
              new Date(b.endAt).getTime(),
            ),
          ).toBe(false);
        }
      }
    }
  });
});

describe('getDemoHistoryBookings', () => {
  const FIXED_NOW = new Date('2026-07-15T12:00:00.000Z');

  it('uses unique startAt values and mixed statuses', () => {
    const rows = getDemoHistoryBookings(14, FIXED_NOW);
    expect(rows.length).toBeGreaterThan(20);
    const starts = rows.map((row) => row.startAt);
    expect(new Set(starts).size).toBe(starts.length);
    const statuses = new Set(rows.map((row) => row.status));
    expect(statuses.has('COMPLETED')).toBe(true);
    expect(
      statuses.has('CANCELLED_BY_CLIENT') || statuses.has('CANCELLED_BY_SHOP'),
    ).toBe(true);
  });
});

describe('getSharedDemoDayBookings', () => {
  it('returns BOOKED rows for today', () => {
    const rows = getSharedDemoDayBookings(new Date('2026-07-15T12:00:00.000Z'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === 'BOOKED')).toBe(true);
  });
});
