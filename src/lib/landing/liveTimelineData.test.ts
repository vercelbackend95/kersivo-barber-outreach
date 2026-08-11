import { describe, expect, it } from 'vitest';

import {
  bookingStartLabelLondon,
  ensureLandingFocusBooking,
  getLandingTimelineData,
} from './liveTimelineData';
import { LANDING_TIMELINE_SCROLL_FOCUS } from './liveTimelineScroll';
import type { TimelineBooking } from '@/components/admin/TodayTimeline';

function stubBooking(overrides: Partial<TimelineBooking> & Pick<TimelineBooking, 'id' | 'startAt' | 'endAt'>): TimelineBooking {
  return {
    fullName: 'Test Client',
    email: 'test@example.com',
    status: 'BOOKED',
    barber: { name: 'Alex' },
    service: { id: 'svc', name: 'Fade' },
    ...overrides,
  };
}

describe('ensureLandingFocusBooking', () => {
  it('leaves bookings unchanged when focus already exists', () => {
    const dayKey = '2026-08-10';
    const rows = [
      stubBooking({
        id: 'a',
        startAt: '2026-08-10T13:10:00.000Z', // 14:10 BST
        endAt: '2026-08-10T13:25:00.000Z',
      }),
      stubBooking({
        id: 'b',
        startAt: '2026-08-10T12:00:00.000Z',
        endAt: '2026-08-10T12:30:00.000Z',
      }),
    ];
    const next = ensureLandingFocusBooking(rows, dayKey);
    expect(next).toBe(rows);
    expect(bookingStartLabelLondon(next[0]!.startAt)).toBe('14:10');
  });

  it('snaps the closest booking to 14:10 when missing', () => {
    const dayKey = '2026-01-15'; // GMT
    const rows = [
      stubBooking({
        id: 'morning',
        startAt: '2026-01-15T09:00:00.000Z',
        endAt: '2026-01-15T09:30:00.000Z',
      }),
      stubBooking({
        id: 'near',
        startAt: '2026-01-15T14:00:00.000Z',
        endAt: '2026-01-15T14:20:00.000Z',
      }),
      stubBooking({
        id: 'late',
        startAt: '2026-01-15T17:00:00.000Z',
        endAt: '2026-01-15T17:30:00.000Z',
      }),
    ];
    const next = ensureLandingFocusBooking(rows, dayKey);
    expect(next.some((b) => bookingStartLabelLondon(b.startAt) === '14:10')).toBe(true);
    const focused = next.find((b) => b.id === 'near')!;
    expect(bookingStartLabelLondon(focused.startAt)).toBe('14:10');
    expect(new Date(focused.endAt).getTime() - new Date(focused.startAt).getTime()).toBe(20 * 60_000);
  });
});

describe('getLandingTimelineData', () => {
  it('always includes at least one 14:10 London booking across sample days', () => {
    const samples = [
      '2026-01-05T12:00:00.000Z',
      '2026-03-15T12:00:00.000Z',
      '2026-07-20T12:00:00.000Z',
      '2026-08-10T18:00:00.000Z',
      '2026-11-02T12:00:00.000Z',
      '2026-12-25T12:00:00.000Z',
    ];

    for (const iso of samples) {
      const { bookings } = getLandingTimelineData(undefined, new Date(iso));
      expect(
        bookings.some((b) => bookingStartLabelLondon(b.startAt) === LANDING_TIMELINE_SCROLL_FOCUS),
      ).toBe(true);
    }
  });
});
