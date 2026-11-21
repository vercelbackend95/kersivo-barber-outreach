import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import { HERITAGE_DEMO_BARBERS } from '@/lib/demo/heritage/demoShapes';
import { EXAMPLE_DAY_KEY, buildAvailabilityExample } from './availabilityExample';
import { getAvailabilityTimelineData } from './availabilityTimeline';

const data = getAvailabilityTimelineData();
const example = buildAvailabilityExample();
const london = (iso: string) => formatInTimeZone(new Date(iso), 'Europe/London', 'HH:mm');

describe('Section 03 real admin timeline data', () => {
  it('is the Heritage Grooming demo owner timeline for the fixed example weekday', () => {
    expect(data.selectedDate).toBe(EXAMPLE_DAY_KEY);
    expect(data.timeBlocks).toEqual([]);
    expect(data.bookings.length).toBeGreaterThan(8);
    expect(data.bookings.every((booking) => booking.status === 'BOOKED')).toBe(true);
    expect(data.bookings.every((booking) => booking.startAt.startsWith(EXAMPLE_DAY_KEY))).toBe(true);
  });

  it('uses the Heritage Grooming barbers and their portraits', () => {
    expect(data.barbers).toEqual(
      HERITAGE_DEMO_BARBERS.map((barber) => ({ id: barber.id, name: barber.name, avatarUrl: barber.image.src })),
    );
    for (const booking of data.bookings) {
      expect(data.barbers.map((barber) => barber.id)).toContain(booking.barberId);
    }
  });

  it('holds exactly the Kit Harlow appointments the client example is computed from', () => {
    const kit = data.bookings.filter((booking) => booking.barber.name === 'Kit Harlow');
    expect(
      kit
        .map((b) => `${london(b.startAt)}-${london(b.endAt)}`)
        .sort(),
    ).toEqual(example.appointments.map((a) => `${a.startLabel}-${a.endLabel}`));
  });
});
