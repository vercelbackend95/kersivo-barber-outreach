import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateSlots } from './slots';
import { londonDayOfWeekFromIsoDate } from './time';

afterEach(() => {
  vi.useRealTimers();
});

const service = {
  durationMinutes: 15,
  bufferMinutes: 0
} as const;

const settings = {
  slotIntervalMinutes: 15,
  defaultBufferMinutes: 0
} as const;

function makeRule(date: string) {
  return {
    dayOfWeek: londonDayOfWeekFromIsoDate(date),
    active: true,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    breakStartMin: null,
    breakEndMin: null
  };
}

describe('generateSlots', () => {
  it('filters out same-day slots before the 30-minute lead time rounded up to the next interval', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:08:00Z'));

    const slots = generateSlots({
      date: '2026-03-23',
      service: service as never,
      rules: [makeRule('2026-03-23') as never],
      confirmedBookings: [],
      timeOff: [],
      timeBlocks: [],
      settings: settings as never
    });

    expect(slots[0]).toBe('12:45');
    expect(slots).not.toContain('12:30');
  });

  it('keeps future-day availability on the normal slot cadence', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:46:00Z'));

    const slots = generateSlots({
      date: '2026-03-24',
      service: service as never,
      rules: [makeRule('2026-03-24') as never],
      confirmedBookings: [],
      timeOff: [],
      timeBlocks: [],
      settings: settings as never
    });

    expect(slots[0]).toBe('09:00');
  });

  it('returns no slots for past days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:00:00Z'));

    const slots = generateSlots({
      date: '2026-03-22',
      service: service as never,
      rules: [makeRule('2026-03-22') as never],
      confirmedBookings: [],
      timeOff: [],
      timeBlocks: [],
      settings: settings as never
    });

    expect(slots).toEqual([]);
  });
});
