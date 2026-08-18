/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_SERVICES } from '@/lib/demo/services';
import { getBlacklineBookingsForDayKey } from '@/lib/admin/blacklineDemoFixtures/schedule';
import { ANY_BARBER_ID } from '@/lib/booking/constants';
import {
  addBlacklineSessionBooking,
  BLACKLINE_SESSION_BOOKINGS_KEY,
} from './blacklineSessionBookings';
import {
  listBlacklineAvailableSlots,
  resolveBlacklineBarberForSlot,
} from './blacklineAvailability';

const WEDNESDAY = '2026-08-12';
const NOON = new Date('2026-08-12T11:00:00.000Z'); // 12:00 BST
const ellis = DEMO_BARBERS[0]!;
const noah = DEMO_BARBERS[1]!;
const haircut = DEMO_SERVICES.find((service) => service.id === 'bl-svc-haircut-finish')!;

describe('blacklineAvailability', () => {
  beforeEach(() => {
    window.sessionStorage.removeItem(BLACKLINE_SESSION_BOOKINGS_KEY);
  });

  afterEach(() => {
    window.sessionStorage.removeItem(BLACKLINE_SESSION_BOOKINGS_KEY);
  });

  it('does not offer slots that overlap seeded bookings for the selected barber', () => {
    const seeded = getBlacklineBookingsForDayKey(WEDNESDAY, { now: NOON });
    const ellisBusy = seeded.filter((row) => row.barberId === ellis.id && row.status === 'BOOKED');
    expect(ellisBusy.length).toBeGreaterThan(0);

    const slots = listBlacklineAvailableSlots({
      date: WEDNESDAY,
      barberId: ellis.id,
      durationMinutes: haircut.durationMinutes,
      now: new Date('2026-08-12T07:00:00.000Z'),
    });

    for (const booking of ellisBusy) {
      const start = new Date(booking.startAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London',
      });
      expect(slots).not.toContain(start);
    }
    expect(slots.length).toBeGreaterThan(0);
  });

  it('blocks a slot already created in the current demo session', () => {
    const open = listBlacklineAvailableSlots({
      date: WEDNESDAY,
      barberId: noah.id,
      durationMinutes: haircut.durationMinutes,
      now: new Date('2026-08-12T07:00:00.000Z'),
    });
    const taken = open[0]!;
    addBlacklineSessionBooking({
      serviceId: haircut.id,
      serviceName: haircut.name,
      durationMinutes: haircut.durationMinutes,
      pricePence: haircut.pricePence,
      barberId: noah.id,
      barberName: noah.name,
      fullName: 'Alex Demo',
      email: 'alex@example.com',
      date: WEDNESDAY,
      startTime: taken,
    });

    const after = listBlacklineAvailableSlots({
      date: WEDNESDAY,
      barberId: noah.id,
      durationMinutes: haircut.durationMinutes,
      now: new Date('2026-08-12T07:00:00.000Z'),
    });
    expect(after).not.toContain(taken);
  });

  it('resolves Any available barber to a concrete free BLACKLINE barber', () => {
    const slots = listBlacklineAvailableSlots({
      date: WEDNESDAY,
      barberId: ANY_BARBER_ID,
      durationMinutes: haircut.durationMinutes,
      now: new Date('2026-08-12T07:00:00.000Z'),
    });
    expect(slots.length).toBeGreaterThan(0);

    const assigned = resolveBlacklineBarberForSlot({
      date: WEDNESDAY,
      time: slots[0]!,
      durationMinutes: haircut.durationMinutes,
      preferredBarberId: ANY_BARBER_ID,
      now: new Date('2026-08-12T07:00:00.000Z'),
    });
    expect(assigned).not.toBeNull();
    expect(DEMO_BARBERS.some((barber) => barber.id === assigned?.id)).toBe(true);
    expect(assigned?.name).not.toBe('Any barber');
  });

  it('returns no slots on Sunday', () => {
    expect(
      listBlacklineAvailableSlots({
        date: '2026-08-16',
        barberId: ellis.id,
        durationMinutes: 45,
        now: new Date('2026-08-16T10:00:00.000Z'),
      }),
    ).toEqual([]);
  });
});
