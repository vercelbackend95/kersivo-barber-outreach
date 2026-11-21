import { describe, expect, it } from 'vitest';
import { HERITAGE_PEOPLE } from '@/lib/admin/heritageDemoFixtures/catalog';
import { getHeritageBookingsForDayKey } from '@/lib/admin/heritageDemoFixtures/schedule';
import { londonWeekdayMon1 } from '@/lib/admin/blacklineDemoFixtures/time';
import {
  EXAMPLE_CLOCK,
  EXAMPLE_DAY_KEY,
  EXAMPLE_SLOT_STEP_MINUTES,
  buildAvailabilityExample,
} from './availabilityExample';

const example = buildAvailabilityExample();
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

describe('Section 03 availability example', () => {
  it('reads a weekday of the Heritage Grooming demo owner timeline with a clock pinned before it', () => {
    expect(londonWeekdayMon1(EXAMPLE_DAY_KEY)).toBe(3);
    expect(EXAMPLE_CLOCK.getTime()).toBeLessThan(Date.parse(`${EXAMPLE_DAY_KEY}T00:00:00Z`));
    expect(example.window).toEqual({ open: 540, close: 1140, openLabel: '09:00', closeLabel: '19:00' });
    expect(example.barber.name).toBe('Kit Harlow');
    expect(example.service).toEqual({ name: 'Skin fade', duration: 45, price: '£29' });
  });

  it("shows Kit Harlow's eight Booked demo appointments inside working hours", () => {
    expect(example.appointments.map((a) => `${a.startLabel}-${a.endLabel} ${a.service}`)).toEqual([
      '09:30-10:00 Children’s fade',
      '10:00-11:00 Skin fade and beard',
      '11:00-12:00 Skin fade and beard',
      '13:00-14:00 Skin fade and beard',
      '14:00-14:45 Skin fade',
      '16:15-17:00 Skin fade',
      '17:30-18:15 Skin fade',
      '18:15-19:00 Skin fade',
    ]);
    const kit = getHeritageBookingsForDayKey(EXAMPLE_DAY_KEY, { now: EXAMPLE_CLOCK }).filter((row) => row.barber.name === 'Kit Harlow');
    expect(kit.every((row) => row.status === 'BOOKED')).toBe(true);
    for (const a of example.appointments) {
      expect(a.start).toBeGreaterThanOrEqual(example.window.open);
      expect(a.end).toBeLessThanOrEqual(example.window.close);
      expect(a.duration).toBe(a.end - a.start);
    }
  });

  it('offers only 15-minute Skin fade starts with 45 free minutes before the next appointment', () => {
    expect(example.offered.map((time) => time.label)).toEqual(['12:00', '12:15', '14:45', '15:00', '15:15', '15:30']);
    for (const time of example.offered) {
      expect(time.end - time.start).toBe(45);
      expect(time.start % EXAMPLE_SLOT_STEP_MINUTES).toBe(0);
      expect(time.start).toBeGreaterThanOrEqual(example.window.open);
      expect(time.end).toBeLessThanOrEqual(example.window.close);
      expect(example.appointments.some((a) => overlaps(time.start, time.end, a.start, a.end))).toBe(false);
    }
    // Every other 15-minute start inside opening hours runs into an appointment.
    for (let start = example.window.open; start + 45 <= example.window.close; start += EXAMPLE_SLOT_STEP_MINUTES) {
      const free = !example.appointments.some((a) => overlaps(start, start + 45, a.start, a.end));
      expect(example.offered.some((time) => time.start === start)).toBe(free);
    }
  });

  it('explains each not-offered time with the appointment it would run into', () => {
    expect(example.notOffered.map((n) => `${n.label}-${n.endLabel} x ${n.blockedBy.startLabel}`)).toEqual([
      '12:30-13:15 x 13:00',
      '12:45-13:30 x 13:00',
    ]);
  });

  it('carries no fictional client identities', () => {
    const serialised = JSON.stringify(example);
    for (const person of HERITAGE_PEOPLE) {
      expect(serialised).not.toContain(person.fullName);
      expect(serialised).not.toContain(person.email);
    }
    expect(serialised).not.toMatch(/@|fullName|email|clientId/);
  });
});
