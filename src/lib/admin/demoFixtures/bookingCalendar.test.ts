import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';

import {
  getDemoBookingsForDayKey,
  getDemoHistoryBookings,
  getSharedDemoDayBookings,
} from './bookingCalendar';

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Minutes past midnight Europe/London, so DST never skews the comparison. */
function londonDayMinute(iso: string): number {
  const [hh, mm] = formatInTimeZone(new Date(iso), 'Europe/London', 'HH:mm').split(':');
  return Number(hh) * 60 + Number(mm);
}

/** Every weekday plus both DST sides, since density varies per weekday. */
const SAMPLE_DAY_KEYS = [
  '2026-01-12',
  '2026-02-24',
  '2026-03-28',
  '2026-03-29',
  '2026-06-15',
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
  '2026-10-24',
  '2026-10-25',
  '2026-12-31',
];

describe('getDemoBookingsForDayKey', () => {
  it('is deterministic for the same dayKey', () => {
    const a = getDemoBookingsForDayKey('2026-07-15');
    const b = getDemoBookingsForDayKey('2026-07-15');
    expect(a.map((row) => ({ id: row.id, startAt: row.startAt, status: row.status }))).toEqual(
      b.map((row) => ({ id: row.id, startAt: row.startAt, status: row.status })),
    );
  });

  it('returns an isolated copy so callers cannot poison the cache', () => {
    const a = getDemoBookingsForDayKey('2026-08-03');
    expect(a.length).toBeGreaterThan(0);
    const originalStart = a[0]!.startAt;
    a[0]!.startAt = '1970-01-01T00:00:00.000Z';
    a[0]!.barber.name = 'MUTATED';

    const b = getDemoBookingsForDayKey('2026-08-03');
    expect(b[0]!.startAt).toBe(originalStart);
    expect(b[0]!.barber.name).not.toBe('MUTATED');
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

  it('keeps every appointment inside 09:00-19:00 London', () => {
    for (const dayKey of SAMPLE_DAY_KEYS) {
      const rows = getDemoBookingsForDayKey(dayKey);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const startMinute = londonDayMinute(row.startAt);
        const endMinute = londonDayMinute(row.endAt);
        expect(
          startMinute,
          `${row.id} starts at ${formatInTimeZone(new Date(row.startAt), 'Europe/London', 'HH:mm')}`,
        ).toBeGreaterThanOrEqual(9 * 60);
        expect(
          endMinute,
          `${row.id} ends at ${formatInTimeZone(new Date(row.endAt), 'Europe/London', 'HH:mm')}`,
        ).toBeLessThanOrEqual(19 * 60);
        expect(endMinute).toBeGreaterThan(startMinute);
      }
    }
  });

  it('staggers chair starts so no two appointments begin at the same time', () => {
    for (const dayKey of SAMPLE_DAY_KEYS) {
      const starts = getDemoBookingsForDayKey(dayKey).map((row) => row.startAt);
      expect(new Set(starts).size).toBe(starts.length);
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
