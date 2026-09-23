/**
 * Shared Booking reminder claim (Date(0) in-flight) helpers for SMS + email reminders
 * and Client erasure coordination.
 *
 * Claim age uses Booking.updatedAt, which Prisma @updatedAt refreshes on the same
 * atomic updateMany that writes the Date(0) sentinel.
 *
 * Residual: unrelated Booking updates while a claim is stranded also refresh
 * updatedAt and postpone stale classification by REMINDER_CLAIM_STALE_MS from
 * each write. Continuous writes could delay recovery; permanent block requires
 * unbounded refresh, which is not realistic for historical bookings eligible
 * for Client erasure (active BOOKED appointments already block erasure).
 */

/** In-flight claim while a reminder provider call is underway. */
export const REMINDER_CLAIM_SENTINEL = new Date(0);

/**
 * Abandoned claims older than this may be reclaimed (workers) or neutralised (erasure).
 *
 * Justification:
 * - Reminder crons run every 15 minutes (vercel.json sms-reminders / email-reminders).
 * - Twilio/Resend provider calls complete in seconds (no custom long request timeout).
 * - Vercel serverless request budgets are typically ≤60–300s.
 * 15 minutes equals one cron period and is comfortably longer than any legitimate
 * in-flight send, so a crashed claim becomes reclaimable on the next cron tick
 * without racing a still-running provider call.
 */
export const REMINDER_CLAIM_STALE_MS = 15 * 60 * 1000;

export function isReminderClaimSentinel(value: Date | null | undefined): boolean {
  return value instanceof Date && value.getTime() === REMINDER_CLAIM_SENTINEL.getTime();
}

export function reminderClaimStaleBefore(
  nowMs: number = Date.now(),
  staleMs: number = REMINDER_CLAIM_STALE_MS,
): Date {
  return new Date(nowMs - staleMs);
}

/** True when Date(0) was written recently enough to treat as an active provider send. */
export function isReminderClaimFresh(
  claimField: Date | null | undefined,
  updatedAt: Date,
  nowMs: number = Date.now(),
  staleMs: number = REMINDER_CLAIM_STALE_MS,
): boolean {
  if (!isReminderClaimSentinel(claimField)) return false;
  return updatedAt.getTime() > nowMs - staleMs;
}

/** Date(0) older than the stale threshold — abandoned / reclaimable. */
export function isReminderClaimStale(
  claimField: Date | null | undefined,
  updatedAt: Date,
  nowMs: number = Date.now(),
  staleMs: number = REMINDER_CLAIM_STALE_MS,
): boolean {
  if (!isReminderClaimSentinel(claimField)) return false;
  return updatedAt.getTime() <= nowMs - staleMs;
}
