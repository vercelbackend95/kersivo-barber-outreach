import { describe, expect, it } from 'vitest';
import {
  canCorrectHistoryBooking,
  canCancelBookingByShop,
  canMarkBookingNoShow,
  getAllowedManualBookingActions,
  getEffectiveBookingStatus,
  getManualBookingActionOptions,
} from './operationalStatus';

describe('getEffectiveBookingStatus', () => {
  const startAt = '2026-05-06T14:30:00.000Z';
  const endAt = '2026-05-06T15:15:00.000Z';

  it('returns BOOKED before start', () => {
    expect(getEffectiveBookingStatus({ status: 'BOOKED', startAt, endAt, nowMs: Date.parse('2026-05-06T14:29:59.999Z') })).toBe('BOOKED');
  });

  it('returns IN_PROGRESS at start and during service', () => {
    expect(getEffectiveBookingStatus({ status: 'BOOKED', startAt, endAt, nowMs: Date.parse('2026-05-06T14:30:00.000Z') })).toBe('IN_PROGRESS');
    expect(getEffectiveBookingStatus({ status: 'BOOKED', startAt, endAt, nowMs: Date.parse('2026-05-06T14:50:00.000Z') })).toBe('IN_PROGRESS');
  });

  it('returns COMPLETED at and after end', () => {
    expect(getEffectiveBookingStatus({ status: 'BOOKED', startAt, endAt, nowMs: Date.parse('2026-05-06T15:15:00.000Z') })).toBe('COMPLETED');
    expect(getEffectiveBookingStatus({ status: 'BOOKED', startAt, endAt, nowMs: Date.parse('2026-05-07T10:00:00.000Z') })).toBe('COMPLETED');
  });

  it('keeps manual/terminal and day-of statuses untouched', () => {
    expect(getEffectiveBookingStatus({ status: 'CANCELLED_BY_SHOP', startAt, endAt, nowMs: Date.parse('2026-05-06T14:50:00.000Z') })).toBe('CANCELLED_BY_SHOP');
    expect(getEffectiveBookingStatus({ status: 'NO_SHOW', startAt, endAt, nowMs: Date.parse('2026-05-07T10:00:00.000Z') })).toBe('NO_SHOW');
    expect(getEffectiveBookingStatus({ status: 'ARRIVED', startAt, endAt, nowMs: Date.parse('2026-05-06T14:50:00.000Z') })).toBe('ARRIVED');
    expect(getEffectiveBookingStatus({ status: 'IN_PROGRESS', startAt, endAt, nowMs: Date.parse('2026-05-06T15:20:00.000Z') })).toBe('IN_PROGRESS');
    expect(getEffectiveBookingStatus({ status: 'COMPLETED', startAt, endAt, nowMs: Date.parse('2026-05-06T14:00:00.000Z') })).toBe('COMPLETED');
  });
});

describe('manual action windows', () => {
  const startAt = '2026-05-06T15:30:00.000Z';
  const endAt = '2026-05-06T16:15:00.000Z';

  it('NO_SHOW is allowed from start onwards', () => {
    expect(canMarkBookingNoShow({ startAt, endAt, nowMs: Date.parse('2026-05-06T15:29:59.999Z') })).toBe(false);
    expect(canMarkBookingNoShow({ startAt, endAt, nowMs: Date.parse('2026-05-06T15:30:00.000Z') })).toBe(true);
    expect(canMarkBookingNoShow({ startAt, endAt, nowMs: Date.parse('2026-05-07T09:00:00.000Z') })).toBe(true);
  });

  it('cancel/reschedule require more than 1 hour to start', () => {
    expect(canCancelBookingByShop({ startAt, endAt, nowMs: Date.parse('2026-05-06T14:29:59.999Z') })).toBe(true);
    expect(canCancelBookingByShop({ startAt, endAt, nowMs: Date.parse('2026-05-06T14:30:00.000Z') })).toBe(false);
  });

  it('returns allowed day-of + shop actions for managers', () => {
    expect(getAllowedManualBookingActions({ startAt, endAt, nowMs: Date.parse('2026-05-06T13:00:00.000Z') }, 'shop')).toEqual([
      'ARRIVED',
      'CANCELLED_BY_SHOP',
      'RESCHEDULE',
    ]);
    expect(getAllowedManualBookingActions({ startAt, endAt, nowMs: Date.parse('2026-05-06T15:35:00.000Z') }, 'shop')).toEqual([
      'ARRIVED',
      'IN_PROGRESS',
      'COMPLETED',
      'NO_SHOW',
    ]);
  });

  it('barber scope excludes cancel and reschedule', () => {
    expect(getAllowedManualBookingActions({ startAt, endAt, nowMs: Date.parse('2026-05-06T13:00:00.000Z') }, 'barber')).toEqual([
      'ARRIVED',
    ]);
    expect(getAllowedManualBookingActions({ startAt, endAt, nowMs: Date.parse('2026-05-06T15:35:00.000Z') }, 'barber')).toEqual([
      'ARRIVED',
      'IN_PROGRESS',
      'COMPLETED',
      'NO_SHOW',
    ]);
  });

  it('returns full shop action list with enabled flags and reasons', () => {
    const beforeStart = getManualBookingActionOptions({
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T14:40:00.000Z'),
    }, 'shop');
    expect(beforeStart.map((o) => ({ value: o.value, enabled: o.enabled }))).toEqual([
      { value: 'ARRIVED', enabled: true },
      { value: 'IN_PROGRESS', enabled: false },
      { value: 'COMPLETED', enabled: false },
      { value: 'NO_SHOW', enabled: false },
      { value: 'CANCELLED_BY_SHOP', enabled: false },
      { value: 'RESCHEDULE', enabled: false },
    ]);

    const moreThanOneHour = getManualBookingActionOptions({
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T14:20:00.000Z'),
    }, 'shop');
    expect(moreThanOneHour.map((o) => ({ value: o.value, enabled: o.enabled }))).toEqual([
      { value: 'ARRIVED', enabled: true },
      { value: 'IN_PROGRESS', enabled: false },
      { value: 'COMPLETED', enabled: false },
      { value: 'NO_SHOW', enabled: false },
      { value: 'CANCELLED_BY_SHOP', enabled: true },
      { value: 'RESCHEDULE', enabled: true },
    ]);
  });

  it('keeps NO_SHOW enabled after booking end (effective completed window)', () => {
    const afterEnd = getManualBookingActionOptions({
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T18:00:00.000Z'),
    }, 'shop');
    expect(afterEnd.map((o) => ({ value: o.value, enabled: o.enabled }))).toEqual([
      { value: 'ARRIVED', enabled: false },
      { value: 'IN_PROGRESS', enabled: true },
      { value: 'COMPLETED', enabled: true },
      { value: 'NO_SHOW', enabled: true },
      { value: 'CANCELLED_BY_SHOP', enabled: false },
      { value: 'RESCHEDULE', enabled: false },
    ]);
  });
});

describe('history status corrections', () => {
  const startAt = '2026-05-06T15:30:00.000Z';
  const endAt = '2026-05-06T16:15:00.000Z';

  it('allows corrections once the appointment has ended', () => {
    expect(canCorrectHistoryBooking({
      status: 'BOOKED',
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T16:15:00.000Z'),
    })).toBe(true);
  });

  it('rejects corrections before the appointment has ended', () => {
    expect(canCorrectHistoryBooking({
      status: 'BOOKED',
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T16:14:59.999Z'),
    })).toBe(false);
  });

  it('allows changing an existing terminal correction', () => {
    expect(canCorrectHistoryBooking({
      status: 'NO_SHOW',
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T15:45:00.000Z'),
    })).toBe(true);
    expect(canCorrectHistoryBooking({
      status: 'CANCELLED_BY_CLIENT',
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T15:45:00.000Z'),
    })).toBe(true);
  });
});
