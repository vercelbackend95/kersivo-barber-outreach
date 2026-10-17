import { describe, expect, it } from 'vitest';
import { getBlacklineBarbersResponse } from '@/lib/admin/blacklineDemoFixtures/catalog';
import { listBlacklineAvailableSlots } from '@/lib/demo/blacklineAvailability';
import { formatInTimeZone } from 'date-fns-tz';
import { EXAMPLE_CLOCK, EXAMPLE_DAY_KEY, buildAvailabilityExample } from './availabilityExample';
import { getAvailabilityTimelineData } from './availabilityTimeline';

const data = getAvailabilityTimelineData();
const example = buildAvailabilityExample();
const london = (iso: string) => formatInTimeZone(new Date(iso), 'Europe/London', 'HH:mm');
const minute = (iso: string) => {
  const [h, m] = london(iso).split(':').map(Number);
  return h * 60 + m;
};

describe('Section 03 real admin timeline data', () => {
  it('is the CUTSTATE demo owner timeline for the fixed example weekday', () => {
    expect(data.selectedDate).toBe(EXAMPLE_DAY_KEY);
    expect(data.timeBlocks).toEqual([]);
    expect(data.bookings.length).toBeGreaterThan(8);
    expect(data.bookings.every((booking) => booking.status === 'BOOKED')).toBe(true);
    expect(data.bookings.every((booking) => booking.startAt.startsWith(EXAMPLE_DAY_KEY))).toBe(true);
  });

  it('uses the barbers and avatars the demo admin loads', () => {
    const admin = getBlacklineBarbersResponse(EXAMPLE_CLOCK).barbers.map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl }));
    expect(data.barbers).toEqual(admin);
    for (const booking of data.bookings) {
      expect(data.barbers.map((barber) => barber.id)).toContain(booking.barberId);
    }
  });

  it("holds exactly the Marcus Bell appointments the client example is computed from", () => {
    const marcus = data.bookings.filter((booking) => booking.barberId === 'bl-barber-marcus');
    expect(marcus.map((b) => `${london(b.startAt)}-${london(b.endAt)} ${b.service.name}`).sort()).toEqual(
      example.appointments.map((a) => `${a.startLabel}-${a.endLabel} ${a.service}`),
    );

    const offered = listBlacklineAvailableSlots({
      date: EXAMPLE_DAY_KEY,
      barberId: 'bl-barber-marcus',
      durationMinutes: example.service.duration,
      now: EXAMPLE_CLOCK,
      occupancy: marcus.map((b) => ({ barberId: 'bl-barber-marcus', startMinute: minute(b.startAt), endMinute: minute(b.endAt) })),
    });
    expect(offered).toEqual(example.offered.map((time) => time.label));
  });
});
