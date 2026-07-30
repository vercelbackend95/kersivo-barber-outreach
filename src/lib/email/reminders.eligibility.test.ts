import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '../booking/sandboxBookings';
import {
  evaluateEmailReminderEligibility,
  reminderWindowBounds,
  REMINDER_WINDOW_MIN_MS,
} from './reminders';

function baseCandidate(now: Date, overrides: Record<string, unknown> = {}) {
  const { windowStart } = reminderWindowBounds(now);
  const startAt = new Date(windowStart.getTime() + 30 * 60 * 1000); // inside window
  return {
    shopId: 'shop-1',
    email: 'client@example.com',
    startAt,
    createdAt: new Date(startAt.getTime() - 48 * 60 * 60 * 1000),
    notes: null as string | null,
    emailReminderSentAt: null as Date | null,
    emailReminderForStartAt: null as Date | null,
    shopPaidAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('evaluateEmailReminderEligibility', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');

  it('accepts a booking ~24h out with email when shop is paid', () => {
    const result = evaluateEmailReminderEligibility(baseCandidate(now), now, { enabled: true });
    expect(result).toEqual({ ok: true, toEmail: 'client@example.com' });
  });

  it('skips when kill switch off', () => {
    const result = evaluateEmailReminderEligibility(baseCandidate(now), now, { enabled: false });
    expect(result).toEqual({ ok: false, reason: 'kill_switch' });
  });

  it('skips demo shop', () => {
    const result = evaluateEmailReminderEligibility(
      baseCandidate(now, { shopId: DEMO_SHOP_ID }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'demo_shop' });
  });

  it('skips unpaid shops', () => {
    const result = evaluateEmailReminderEligibility(
      baseCandidate(now, { shopPaidAt: null }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'shop_unpaid' });
  });

  it('skips sandbox test bookings', () => {
    const result = evaluateEmailReminderEligibility(
      baseCandidate(now, { notes: `${OWNER_TEST_BOOKING_NOTES_PREFIX} owner check` }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'test_booking' });
  });

  it('skips missing / invalid email', () => {
    expect(
      evaluateEmailReminderEligibility(baseCandidate(now, { email: '' }), now, { enabled: true }),
    ).toEqual({ ok: false, reason: 'no_email' });
    expect(
      evaluateEmailReminderEligibility(baseCandidate(now, { email: 'not-an-email' }), now, {
        enabled: true,
      }),
    ).toEqual({ ok: false, reason: 'invalid_email' });
  });

  it('skips already sent', () => {
    const result = evaluateEmailReminderEligibility(
      baseCandidate(now, { emailReminderSentAt: new Date('2026-07-26T12:00:00.000Z') }),
      now,
      { enabled: true },
    );
    expect(result).toEqual({ ok: false, reason: 'already_sent' });
  });

  it('skips outside the 23–25h window', () => {
    const tooSoon = evaluateEmailReminderEligibility(
      baseCandidate(now, { startAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) }),
      now,
      { enabled: true },
    );
    expect(tooSoon).toEqual({ ok: false, reason: 'outside_window' });

    const tooFar = evaluateEmailReminderEligibility(
      baseCandidate(now, { startAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) }),
      now,
      { enabled: true },
    );
    expect(tooFar).toEqual({ ok: false, reason: 'outside_window' });
  });

  it('skips when created too late for a day-before reminder', () => {
    const startAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const result = evaluateEmailReminderEligibility(
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
    const result = evaluateEmailReminderEligibility(
      baseCandidate(now, {
        emailReminderSentAt: null,
        emailReminderForStartAt: null,
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
