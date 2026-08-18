/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import {
  BLACKLINE_SESSION_BOOKINGS_KEY,
  BLACKLINE_SESSION_BOOKING_SOURCE,
  BLACKLINE_SESSION_BOOKING_TAG,
  addBlacklineSessionBooking,
  buildBlacklineSessionBooking,
  isBlacklineSessionBooking,
  listBlacklineSessionBookings,
  mergeBlacklineSessionBookings,
  saveBlacklineSessionBooking,
  toAdminBooking,
} from './blacklineSessionBookings';

const WEDNESDAY = '2026-08-12';

function clearStore() {
  window.sessionStorage.removeItem(BLACKLINE_SESSION_BOOKINGS_KEY);
}

describe('blacklineSessionBookings', () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  it('creates a session booking with matching visible reference and London start/end', () => {
    const created = addBlacklineSessionBooking({
      serviceId: 'bl-svc-haircut-finish',
      serviceName: 'Haircut & Finish',
      durationMinutes: 35,
      pricePence: 2200,
      barberId: 'bl-barber-noah',
      barberName: 'Noah Reid',
      fullName: 'Alex Demo',
      email: 'alex@example.com',
      phone: '07123456789',
      date: WEDNESDAY,
      startTime: '12:00',
      now: new Date('2026-08-12T10:00:00.000Z'),
    });

    expect(created.source).toBe(BLACKLINE_SESSION_BOOKING_SOURCE);
    expect(created.status).toBe('BOOKED');
    expect(created.reference).toMatch(/^BL-\d{4}$/);
    expect(created.id).toMatch(/[0-9a-f-]{8,}/i);
    expect(formatInTimeZone(new Date(created.startAt), 'Europe/London', 'yyyy-MM-dd HH:mm')).toBe(
      '2026-08-12 12:00',
    );
    expect(formatInTimeZone(new Date(created.endAt), 'Europe/London', 'yyyy-MM-dd HH:mm')).toBe(
      '2026-08-12 12:35',
    );
    expect(created.startAt.endsWith('Z')).toBe(true);
    expect(created.startAt.startsWith('2026-08-12T12:00:00')).toBe(false);

    const stored = listBlacklineSessionBookings(new Date('2026-08-12T10:00:00.000Z'));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.reference).toBe(created.reference);
    expect(stored[0]?.id).toBe(created.id);
    expect(stored[0]?.barberName).toBe('Noah Reid');
    expect(stored[0]?.serviceName).toBe('Haircut & Finish');
    expect(stored[0]?.fullName).toBe('Alex Demo');
  });

  it('ignores malformed session data safely', () => {
    window.sessionStorage.setItem(BLACKLINE_SESSION_BOOKINGS_KEY, '{not-json');
    expect(listBlacklineSessionBookings()).toEqual([]);

    window.sessionStorage.setItem(
      BLACKLINE_SESSION_BOOKINGS_KEY,
      JSON.stringify([{ id: 1, source: 'other' }, null, 'x']),
    );
    expect(listBlacklineSessionBookings()).toEqual([]);
    expect(isBlacklineSessionBooking({ id: 'x' })).toBe(false);
  });

  it('prunes stale demo bookings and keeps an array of current ones', () => {
    const stale = buildBlacklineSessionBooking({
      serviceId: 'bl-svc-skin-fade',
      serviceName: 'Skin Fade',
      durationMinutes: 45,
      pricePence: 2500,
      barberId: 'bl-barber-ellis',
      barberName: 'Ellis Ward',
      fullName: 'Old Guest',
      email: 'old@example.com',
      date: WEDNESDAY,
      startTime: '12:00',
      now: new Date('2026-08-10T10:00:00.000Z'),
    });
    const fresh = buildBlacklineSessionBooking({
      serviceId: 'bl-svc-skin-fade',
      serviceName: 'Skin Fade',
      durationMinutes: 45,
      pricePence: 2500,
      barberId: 'bl-barber-ellis',
      barberName: 'Ellis Ward',
      fullName: 'New Guest',
      email: 'new@example.com',
      date: WEDNESDAY,
      startTime: '16:00',
      now: new Date('2026-08-12T10:00:00.000Z'),
    });
    saveBlacklineSessionBooking(stale, new Date('2026-08-10T10:00:00.000Z'));
    saveBlacklineSessionBooking(fresh, new Date('2026-08-12T10:00:00.000Z'));

    const listed = listBlacklineSessionBookings(new Date('2026-08-12T12:00:00.000Z'));
    expect(listed.map((row) => row.id)).toEqual([fresh.id]);
  });

  it('merges seeded and session bookings by id without duplicates', () => {
    const created = addBlacklineSessionBooking({
      serviceId: 'bl-svc-haircut-finish',
      serviceName: 'Haircut & Finish',
      durationMinutes: 35,
      pricePence: 2200,
      barberId: 'bl-barber-noah',
      barberName: 'Noah Reid',
      fullName: 'Alex Demo',
      email: 'alex@example.com',
      date: WEDNESDAY,
      startTime: '12:00',
    });
    const seeded = [
      { id: 'bl-seed-1', startAt: '2026-08-12T08:00:00.000Z' },
      { id: created.id, startAt: created.startAt },
    ];

    const first = mergeBlacklineSessionBookings(seeded, WEDNESDAY);
    const second = mergeBlacklineSessionBookings(first, WEDNESDAY);
    expect(second.filter((row) => row.id === created.id)).toHaveLength(1);

    const mapped = toAdminBooking(created);
    expect(mapped.clientTags).toEqual([BLACKLINE_SESSION_BOOKING_TAG]);
    expect(mapped.service.name).toBe('Haircut & Finish');
    expect(mapped.barber.name).toBe('Noah Reid');
  });
});
