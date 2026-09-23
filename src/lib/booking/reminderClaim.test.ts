import { describe, expect, it } from 'vitest';
import {
  isReminderClaimFresh,
  isReminderClaimSentinel,
  isReminderClaimStale,
  REMINDER_CLAIM_SENTINEL,
  REMINDER_CLAIM_STALE_MS,
  reminderClaimStaleBefore,
} from './reminderClaim';

describe('reminderClaim', () => {
  const nowMs = Date.parse('2026-09-23T12:00:00.000Z');

  it('identifies Date(0) sentinel only', () => {
    expect(isReminderClaimSentinel(REMINDER_CLAIM_SENTINEL)).toBe(true);
    expect(isReminderClaimSentinel(new Date(0))).toBe(true);
    expect(isReminderClaimSentinel(null)).toBe(false);
    expect(isReminderClaimSentinel(new Date(nowMs))).toBe(false);
    expect(isReminderClaimSentinel(new Date(1))).toBe(false);
  });

  it('treats recent updatedAt as fresh in-flight', () => {
    const updatedAt = new Date(nowMs - 60_000);
    expect(isReminderClaimFresh(REMINDER_CLAIM_SENTINEL, updatedAt, nowMs)).toBe(true);
    expect(isReminderClaimStale(REMINDER_CLAIM_SENTINEL, updatedAt, nowMs)).toBe(false);
  });

  it('treats updatedAt older than stale threshold as abandoned', () => {
    const updatedAt = new Date(nowMs - REMINDER_CLAIM_STALE_MS - 1);
    expect(isReminderClaimFresh(REMINDER_CLAIM_SENTINEL, updatedAt, nowMs)).toBe(false);
    expect(isReminderClaimStale(REMINDER_CLAIM_SENTINEL, updatedAt, nowMs)).toBe(true);
    expect(reminderClaimStaleBefore(nowMs).getTime()).toBe(nowMs - REMINDER_CLAIM_STALE_MS);
  });
});
