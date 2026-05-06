import { describe, expect, it } from 'vitest';
import {
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

  it('keeps manual/terminal statuses untouched', () => {
    expect(getEffectiveBookingStatus({ status: 'CANCELLED_BY_SHOP', startAt, endAt, nowMs: Date.parse('2026-05-06T14:50:00.000Z') })).toBe('CANCELLED_BY_SHOP');
    expect(getEffectiveBookingStatus({ status: 'NO_SHOW', startAt, endAt, nowMs: Date.parse('2026-05-07T10:00:00.000Z') })).toBe('NO_SHOW');
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

  it('returns allowed actions for each window', () => {
    expect(getAllowedManualBookingActions({ startAt, endAt, nowMs: Date.parse('2026-05-06T13:00:00.000Z') })).toEqual([
      'CANCELLED_BY_SHOP',
      'RESCHEDULE',
    ]);
    expect(getAllowedManualBookingActions({ startAt, endAt, nowMs: Date.parse('2026-05-06T15:35:00.000Z') })).toEqual([
      'NO_SHOW',
    ]);
  });

  it('returns full action list with enabled flags and reasons', () => {
    const beforeStart = getManualBookingActionOptions({
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T14:40:00.000Z'),
    });
    expect(beforeStart).toEqual([
      {
        value: 'NO_SHOW',
        label: 'No Show',
        enabled: false,
        reason: 'Available once booking start time is reached.',
      },
      {
        value: 'CANCELLED_BY_SHOP',
        label: 'Cancel by shop',
        enabled: false,
        reason: 'Unavailable now: allowed only more than 1 hour before start.',
      },
      {
        value: 'RESCHEDULE',
        label: 'Reschedule',
        enabled: false,
        reason: 'Unavailable now: allowed only more than 1 hour before start.',
      },
    ]);

    const moreThanOneHour = getManualBookingActionOptions({
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T14:20:00.000Z'),
    });
    expect(moreThanOneHour).toEqual([
      {
        value: 'NO_SHOW',
        label: 'No Show',
        enabled: false,
        reason: 'Available once booking start time is reached.',
      },
      {
        value: 'CANCELLED_BY_SHOP',
        label: 'Cancel by shop',
        enabled: true,
        reason: 'Available only more than 1 hour before booking start.',
      },
      {
        value: 'RESCHEDULE',
        label: 'Reschedule',
        enabled: true,
        reason: 'Available only more than 1 hour before booking start.',
      },
    ]);
  });

  it('keeps NO_SHOW enabled after booking end (effective completed window)', () => {
    const afterEnd = getManualBookingActionOptions({
      startAt,
      endAt,
      nowMs: Date.parse('2026-05-06T18:00:00.000Z'),
    });
    expect(afterEnd).toEqual([
      {
        value: 'NO_SHOW',
        label: 'No Show',
        enabled: true,
        reason: 'Available from booking start onward.',
      },
      {
        value: 'CANCELLED_BY_SHOP',
        label: 'Cancel by shop',
        enabled: false,
        reason: 'Unavailable now: allowed only more than 1 hour before start.',
      },
      {
        value: 'RESCHEDULE',
        label: 'Reschedule',
        enabled: false,
        reason: 'Unavailable now: allowed only more than 1 hour before start.',
      },
    ]);
  });
});
