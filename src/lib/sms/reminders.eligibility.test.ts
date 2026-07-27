import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '../booking/sandboxBookings';
import {
  evaluateReminderEligibility,
  reminderWindowBounds,
  REMINDER_WINDOW_MIN_MS,
} from './reminders';

function baseCandidate(now: Date, overrides: Record<string, unknown> = {}) {
  const { windowStart } = reminderWindowBounds(now);
  const startAt = new Date(windowStart.getTime() + 30 * 60 * 1000); // inside window
  return {
    shopId: 'shop-1',
    phone: '07123456789',
    startAt,
    createdAt: new Date(startAt.getTime() - 48 * 60 * 60 * 1000),
    notes: null as string | null,
    smsReminderSentAt: null as Date | null,
    smsReminderForStartAt: null as Date | null,
    ...overrides,
  };
}

describe('evaluateReminderEligibility', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');

  it('accepts a booking ~24h out with UK phone when enabled', () => {
    const result = evaluateReminderEligibility(baseCandidate(now), now, { enabled: true });
    expect(result).toEqual({ ok: true, toE164: '+447123456789' });
  });

  it('skips when kill switch off', () => {
    const result = evaluateReminderEligibility(baseCandidate(now), now, { enabled: false });
    expect(result).toEqual({ ok: false, reason: 'kill_switch' });
  });

  it('skips demo shop', () => {
    const result = evaluateReminderEligibility(
      baseCandidate(now, { shopId: DEMO_SHOP_ID }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'demo_shop' });
  });

  it('skips sandbox test bookings', () => {
    const result = evaluateReminderEligibility(
      baseCandidate(now, { notes: `${OWNER_TEST_BOOKING_NOTES_PREFIX} owner check` }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'test_booking' });
  });

  it('skips missing / invalid phone', () => {
    expect(
      evaluateReminderEligibility(baseCandidate(now, { phone: null }), now, { enabled: true }),
    ).toEqual({ ok: false, reason: 'no_phone' });
    expect(
      evaluateReminderEligibility(baseCandidate(now, { phone: '123' }), now, { enabled: true }),
    ).toEqual({ ok: false, reason: 'invalid_phone' });
  });

  it('skips already sent', () => {
    const result = evaluateReminderEligibility(
      baseCandidate(now, { smsReminderSentAt: new Date('2026-07-26T12:00:00.000Z') }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'already_sent' });
  });

  it('skips outside the 23–25h window', () => {
    const tooSoon = evaluateReminderEligibility(
      baseCandidate(now, { startAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) }),
      now,
      { enabled: true },
    );
    expect(tooSoon).toEqual({ ok: false, reason: 'outside_window' });

    const tooFar = evaluateReminderEligibility(
      baseCandidate(now, { startAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) }),
      now,
      { enabled: true },
    );
    expect(tooFar).toEqual({ ok: false, reason: 'outside_window' });
  });

  it('skips when created too late for a day-before reminder', () => {
    const startAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const result = evaluateReminderEligibility(
      baseCandidate(now, {
        startAt,
        createdAt: new Date(startAt.getTime() - REMINDER_WINDOW_MIN_MS + 60_000),
      }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'created_too_late' });
  });

  it('re-arms after reschedule when sent markers cleared', () => {
    const result = evaluateReminderEligibility(
      baseCandidate(now, {
        smsReminderSentAt: null,
        smsReminderForStartAt: null,
      }),
      now,
      { enabled: true },
    );
    expect(result.ok).toBe(true);
  });
});

describe('reminderWindowBounds', () => {
  it('spans 23h–25h ahead of now', () => {
    const now = new Date('2026-07-27T12:00:00.000Z');
    const { windowStart, windowEnd } = reminderWindowBounds(now);
    expect(windowStart.toISOString()).toBe('2026-07-28T11:00:00.000Z');
    expect(windowEnd.toISOString()).toBe('2026-07-28T13:00:00.000Z');
  });
});
