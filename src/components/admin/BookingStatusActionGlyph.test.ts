import { describe, expect, it } from 'vitest';
import {
  getStatusActionVisual,
  getStatusRingProgress,
} from '@/components/admin/BookingStatusActionGlyph';

describe('getStatusActionVisual', () => {
  it('maps day-of phases to short labels and tones', () => {
    expect(getStatusActionVisual('BOOKED')).toMatchObject({
      phase: 'BOOKED',
      tone: 'confirmed',
      label: 'Booked',
    });
    expect(getStatusActionVisual('ARRIVED')).toMatchObject({
      phase: 'ARRIVED',
      tone: 'confirmed',
      label: 'Arrived',
    });
    expect(getStatusActionVisual('IN_PROGRESS')).toMatchObject({
      phase: 'IN_PROGRESS',
      tone: 'confirmed',
      label: 'In progress',
    });
    expect(getStatusActionVisual('COMPLETED')).toMatchObject({
      phase: 'COMPLETED',
      tone: 'confirmed',
      label: 'Completed',
    });
    expect(getStatusActionVisual('NO_SHOW')).toMatchObject({
      phase: 'NO_SHOW',
      tone: 'cancelled',
      label: 'No show',
    });
    expect(getStatusActionVisual('CANCELLED_BY_SHOP')).toMatchObject({
      phase: 'CANCELLED',
      tone: 'cancelled',
      label: 'Cancelled',
    });
  });

  it('treats BOOKED + rescheduledAt as rescheduled', () => {
    expect(getStatusActionVisual('BOOKED', '2026-08-01T10:00:00.000Z')).toMatchObject({
      phase: 'RESCHEDULED',
      tone: 'rescheduled',
      label: 'Rescheduled',
    });
  });
});

describe('getStatusRingProgress', () => {
  const startAt = '2026-08-05T12:00:00.000Z';
  const endAt = '2026-08-05T13:00:00.000Z';

  it('fills lead-up window for BOOKED before start', () => {
    const hourBefore = Date.parse('2026-08-05T11:00:00.000Z');
    const halfHourBefore = Date.parse('2026-08-05T11:30:00.000Z');
    expect(
      getStatusRingProgress({ phase: 'BOOKED', startAt, endAt, nowMs: hourBefore }),
    ).toBeCloseTo(0, 5);
    expect(
      getStatusRingProgress({ phase: 'BOOKED', startAt, endAt, nowMs: halfHourBefore }),
    ).toBeCloseTo(0.5, 5);
  });

  it('tracks appointment elapsed for ARRIVED / IN_PROGRESS', () => {
    const mid = Date.parse('2026-08-05T12:30:00.000Z');
    expect(
      getStatusRingProgress({ phase: 'IN_PROGRESS', startAt, endAt, nowMs: mid }),
    ).toBeCloseTo(0.5, 5);
    expect(
      getStatusRingProgress({ phase: 'ARRIVED', startAt, endAt, nowMs: mid }),
    ).toBeCloseTo(0.5, 5);
  });

  it('is full for COMPLETED and empty for muted terminals', () => {
    expect(getStatusRingProgress({ phase: 'COMPLETED', startAt, endAt })).toBe(1);
    expect(getStatusRingProgress({ phase: 'CANCELLED', startAt, endAt })).toBe(0);
    expect(getStatusRingProgress({ phase: 'NO_SHOW', startAt, endAt })).toBe(0);
  });
});
