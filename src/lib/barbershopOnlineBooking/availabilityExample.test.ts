import { describe, expect, it } from 'vitest';
import { BLACKLINE_PEOPLE } from '@/lib/admin/blacklineDemoFixtures/catalog';
import { getBlacklineBookingsForDayKey } from '@/lib/admin/blacklineDemoFixtures/schedule';
import { londonWeekdayMon1 } from '@/lib/admin/blacklineDemoFixtures/time';
import { listBlacklineAvailableSlots } from '@/lib/demo/blacklineAvailability';
import {
  EXAMPLE_CLOCK,
  EXAMPLE_DAY_KEY,
  EXAMPLE_SLOT_STEP_MINUTES,
  buildAvailabilityExample,
} from './availabilityExample';

const example = buildAvailabilityExample();
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

describe('Section 03 availability example', () => {
  it('reads a weekday of the CUTSTATE demo owner timeline with a clock pinned before it', () => {
    expect(londonWeekdayMon1(EXAMPLE_DAY_KEY)).toBe(3);
    expect(EXAMPLE_CLOCK.getTime()).toBeLessThan(Date.parse(`${EXAMPLE_DAY_KEY}T00:00:00Z`));
    expect(example.window).toEqual({ open: 540, close: 1140, openLabel: '09:00', closeLabel: '19:00' });
    expect(example.barber.name).toBe('Marcus Bell');
    expect(example.service).toEqual({ name: 'Skin Fade', duration: 45, price: '£28' });
  });

  it("shows Marcus Bell's eight Booked demo appointments inside working hours", () => {
    expect(example.appointments.map((a) => `${a.startLabel}-${a.endLabel} ${a.service}`)).toEqual([
      '09:00-10:00 Haircut & Beard',
      '10:15-11:00 Skin Fade',
      '11:15-11:50 Classic Cut & Finish',
      '13:00-13:40 Hot Towel Wet Shave',
      '14:00-15:00 Haircut & Beard',
      '15:15-15:50 Classic Cut & Finish',
      '16:15-17:00 Skin Fade',
      '17:15-17:50 Classic Cut & Finish',
    ]);
    const marcus = getBlacklineBookingsForDayKey(EXAMPLE_DAY_KEY, { now: EXAMPLE_CLOCK }).filter((row) => row.barberId === 'bl-barber-marcus');
    expect(marcus.every((row) => row.status === 'BOOKED')).toBe(true);
    for (const a of example.appointments) {
      expect(a.start).toBeGreaterThanOrEqual(example.window.open);
      expect(a.end).toBeLessThanOrEqual(example.window.close);
      expect(a.duration).toBe(a.end - a.start);
    }
  });

  it('offers exactly the Skin Fade times the demo slot function returns, each with 45 free minutes', () => {
    const occupancy = example.appointments.map((a) => ({ barberId: 'bl-barber-marcus', startMinute: a.start, endMinute: a.end }));
    const real = listBlacklineAvailableSlots({
      date: EXAMPLE_DAY_KEY,
      barberId: 'bl-barber-marcus',
      durationMinutes: 45,
      now: EXAMPLE_CLOCK,
      occupancy,
    });
    expect(example.offered.map((time) => time.label)).toEqual(real);
    expect(real).toEqual(['12:00', '12:15', '18:00', '18:15']);
    for (const time of example.offered) {
      expect(time.end - time.start).toBe(45);
      expect(time.start % EXAMPLE_SLOT_STEP_MINUTES).toBe(0);
      expect(time.end).toBeLessThanOrEqual(example.window.close);
      expect(example.appointments.some((a) => overlaps(time.start, time.end, a.start, a.end))).toBe(false);
    }
  });

  it('explains each not-offered time with the appointment it would run into', () => {
    expect(example.notOffered.map((n) => `${n.label}-${n.endLabel} x ${n.blockedBy.startLabel}`)).toEqual([
      '11:45-12:30 x 11:15',
      '12:30-13:15 x 13:00',
    ]);
  });

  it('carries no fictional client identities', () => {
    const serialised = JSON.stringify(example);
    for (const person of BLACKLINE_PEOPLE) {
      expect(serialised).not.toContain(person.fullName);
      expect(serialised).not.toContain(person.email);
    }
    expect(serialised).not.toMatch(/@|fullName|email|clientId/);
  });
});
