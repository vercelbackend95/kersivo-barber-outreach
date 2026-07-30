import {
  BookingStatus,
  EmailOutboundPurpose,
  EmailOutboundStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../db/client';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '../booking/sandboxBookings';
import {
  buildAppointmentReminderEmail,
  EmailDeliveryError,
  isEmailDeliveryConfigured,
  sendAppointmentReminderEmail,
} from './sender';

/** Reminder window around T-24h (cron every 15m) — shared with SMS reminders. */
export const REMINDER_WINDOW_MIN_MS = 23 * 60 * 60 * 1000;
export const REMINDER_WINDOW_MAX_MS = 25 * 60 * 60 * 1000;

export const DEFAULT_EMAIL_REMINDER_BATCH_LIMIT = 75;

/** Sentinel used while a send is in flight (cleared on failure). */
export const EMAIL_REMINDER_CLAIM_SENTINEL = new Date(0);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailReminderCandidate = {
  id: string;
  shopId: string;
  email: string;
  fullName: string;
  startAt: Date;
  createdAt: Date;
  notes: string | null;
  emailReminderSentAt: Date | null;
  emailReminderForStartAt: Date | null;
  shopPaidAt: Date | null;
  shopName: string;
  shopTimezone: string;
  serviceName: string;
  barberName: string;
};

export type EmailReminderEligibilityReason =
  | 'ok'
  | 'kill_switch'
  | 'demo_shop'
  | 'shop_unpaid'
  | 'test_booking'
  | 'no_email'
  | 'invalid_email'
  | 'already_sent'
  | 'created_too_late'
  | 'outside_window';

/**
 * Kill switch: default on (marketing claim is live).
 * Set EMAIL_REMINDERS_ENABLED=false for emergency off.
 */
export function isEmailRemindersEnabled(): boolean {
  const raw = (
    import.meta.env.EMAIL_REMINDERS_ENABLED ??
    (typeof process !== 'undefined' ? process.env.EMAIL_REMINDERS_ENABLED : '') ??
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  return true;
}

export function reminderWindowBounds(now: Date): { windowStart: Date; windowEnd: Date } {
  const t = now.getTime();
  return {
    windowStart: new Date(t + REMINDER_WINDOW_MIN_MS),
    windowEnd: new Date(t + REMINDER_WINDOW_MAX_MS),
  };
}

export function isSandboxBookingNotes(notes: string | null | undefined): boolean {
  const value = notes?.trim() ?? '';
  return (
    value === OWNER_TEST_BOOKING_NOTES_PREFIX ||
    value.startsWith(`${OWNER_TEST_BOOKING_NOTES_PREFIX} `)
  );
}

export function evaluateEmailReminderEligibility(
  candidate: Pick<
    EmailReminderCandidate,
    | 'shopId'
    | 'email'
    | 'startAt'
    | 'createdAt'
    | 'notes'
    | 'emailReminderSentAt'
    | 'emailReminderForStartAt'
    | 'shopPaidAt'
  >,
  now: Date,
  options?: { enabled?: boolean },
): { ok: true; toEmail: string } | { ok: false; reason: EmailReminderEligibilityReason } {
  const enabled = options?.enabled ?? isEmailRemindersEnabled();
  if (!enabled) return { ok: false, reason: 'kill_switch' };
  if (candidate.shopId === DEMO_SHOP_ID) return { ok: false, reason: 'demo_shop' };
  if (candidate.shopPaidAt == null) return { ok: false, reason: 'shop_unpaid' };
  if (isSandboxBookingNotes(candidate.notes)) return { ok: false, reason: 'test_booking' };

  const toEmail = candidate.email?.trim() ?? '';
  if (!toEmail) return { ok: false, reason: 'no_email' };
  if (!EMAIL_REGEX.test(toEmail)) return { ok: false, reason: 'invalid_email' };

  if (candidate.emailReminderSentAt != null) {
    return { ok: false, reason: 'already_sent' };
  }

  const { windowStart, windowEnd } = reminderWindowBounds(now);
  if (candidate.startAt < windowStart || candidate.startAt > windowEnd) {
    return { ok: false, reason: 'outside_window' };
  }

  // Skip if booking was created inside the reminder window (too late for a day-before email).
  const latestUsefulCreate = new Date(candidate.startAt.getTime() - REMINDER_WINDOW_MIN_MS);
  if (candidate.createdAt > latestUsefulCreate) {
    return { ok: false, reason: 'created_too_late' };
  }

  return { ok: true, toEmail };
}

export async function findDueEmailReminders(
  now: Date = new Date(),
  limit: number = DEFAULT_EMAIL_REMINDER_BATCH_LIMIT,
): Promise<EmailReminderCandidate[]> {
  const { windowStart, windowEnd } = reminderWindowBounds(now);

  const rows = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      startAt: { gte: windowStart, lte: windowEnd },
      emailReminderSentAt: null,
      barber: {
        shopId: { not: DEMO_SHOP_ID },
        shop: { shopPaidAt: { not: null } },
      },
      OR: [
        { notes: null },
        {
          AND: [
            { NOT: { notes: OWNER_TEST_BOOKING_NOTES_PREFIX } },
            { NOT: { notes: { startsWith: `${OWNER_TEST_BOOKING_NOTES_PREFIX} ` } } },
          ],
        },
      ],
    },
    take: limit,
    orderBy: { startAt: 'asc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      startAt: true,
      createdAt: true,
      notes: true,
      emailReminderSentAt: true,
      emailReminderForStartAt: true,
      serviceNameAtBooking: true,
      barber: {
        select: {
          name: true,
          shopId: true,
          shop: { select: { name: true, timezone: true, shopPaidAt: true } },
        },
      },
      service: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    shopId: row.barber.shopId,
    email: row.email,
    fullName: row.fullName,
    startAt: row.startAt,
    createdAt: row.createdAt,
    notes: row.notes,
    emailReminderSentAt: row.emailReminderSentAt,
    emailReminderForStartAt: row.emailReminderForStartAt,
    shopPaidAt: row.barber.shop.shopPaidAt,
    shopName: row.barber.shop.name,
    shopTimezone: row.barber.shop.timezone || 'Europe/London',
    serviceName: row.serviceNameAtBooking?.trim() || row.service.name,
    barberName: row.barber.name,
  }));
}

export type ProcessEmailRemindersResult = {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  skipReasons: Partial<Record<EmailReminderEligibilityReason, number>>;
};

async function claimEmailReminderSend(bookingId: string, startAt: Date): Promise<boolean> {
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.BOOKED,
      startAt,
      emailReminderSentAt: null,
    },
    data: {
      emailReminderSentAt: EMAIL_REMINDER_CLAIM_SENTINEL,
      emailReminderForStartAt: startAt,
    },
  });
  return result.count > 0;
}

async function releaseEmailReminderClaim(bookingId: string): Promise<void> {
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      emailReminderSentAt: EMAIL_REMINDER_CLAIM_SENTINEL,
    },
    data: {
      emailReminderSentAt: null,
      emailReminderForStartAt: null,
    },
  });
}

export async function sendAppointmentEmailReminder(
  candidate: EmailReminderCandidate,
  now: Date = new Date(),
): Promise<{
  status: 'sent' | 'skipped' | 'failed';
  reason?: EmailReminderEligibilityReason;
  error?: string;
}> {
  const eligibility = evaluateEmailReminderEligibility(candidate, now);
  if (!eligibility.ok) {
    return { status: 'skipped', reason: eligibility.reason };
  }

  const claimed = await claimEmailReminderSend(candidate.id, candidate.startAt);
  if (!claimed) {
    return { status: 'skipped', reason: 'already_sent' };
  }

  const { subject } = buildAppointmentReminderEmail({
    to: eligibility.toEmail,
    fullName: candidate.fullName,
    shopName: candidate.shopName,
    serviceName: candidate.serviceName,
    barberName: candidate.barberName,
    startAt: candidate.startAt,
    timezone: candidate.shopTimezone,
  });

  const outbound = await prisma.emailOutbound.create({
    data: {
      shopId: candidate.shopId,
      bookingId: candidate.id,
      toEmail: eligibility.toEmail,
      subject,
      purpose: EmailOutboundPurpose.APPOINTMENT_REMINDER,
      provider: isEmailDeliveryConfigured() ? 'resend' : 'dev-log',
      status: EmailOutboundStatus.QUEUED,
    },
  });

  try {
    const result = await sendAppointmentReminderEmail({
      to: eligibility.toEmail,
      fullName: candidate.fullName,
      shopName: candidate.shopName,
      serviceName: candidate.serviceName,
      barberName: candidate.barberName,
      startAt: candidate.startAt,
      timezone: candidate.shopTimezone,
    });
    const sentAt = new Date();

    await prisma.$transaction([
      prisma.emailOutbound.update({
        where: { id: outbound.id },
        data: {
          provider: isEmailDeliveryConfigured() ? 'resend' : 'dev-log',
          providerMessageId: result.messageId,
          status: EmailOutboundStatus.SENT,
        },
      }),
      prisma.booking.update({
        where: { id: candidate.id },
        data: {
          emailReminderSentAt: sentAt,
          emailReminderForStartAt: candidate.startAt,
        },
      }),
    ]);

    return { status: 'sent' };
  } catch (error) {
    const message =
      error instanceof EmailDeliveryError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown email send error';

    await prisma.emailOutbound.update({
      where: { id: outbound.id },
      data: {
        status: EmailOutboundStatus.FAILED,
        error: message.slice(0, 500),
        provider: isEmailDeliveryConfigured() ? 'resend' : 'dev-log',
      },
    });
    await releaseEmailReminderClaim(candidate.id);

    console.error('[EMAIL] Appointment reminder failed', {
      bookingId: candidate.id,
      error: message,
    });

    return { status: 'failed', error: message };
  }
}

export async function processDueAppointmentEmailReminders(
  now: Date = new Date(),
  options?: { limit?: number },
): Promise<ProcessEmailRemindersResult> {
  const result: ProcessEmailRemindersResult = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    skipReasons: {},
  };

  if (!isEmailRemindersEnabled()) {
    result.skipReasons.kill_switch = 1;
    return result;
  }

  const due = await findDueEmailReminders(now, options?.limit ?? DEFAULT_EMAIL_REMINDER_BATCH_LIMIT);
  result.scanned = due.length;

  for (const candidate of due) {
    const outcome = await sendAppointmentEmailReminder(candidate, now);
    if (outcome.status === 'sent') {
      result.sent += 1;
    } else if (outcome.status === 'failed') {
      result.failed += 1;
    } else {
      result.skipped += 1;
      if (outcome.reason) {
        result.skipReasons[outcome.reason] = (result.skipReasons[outcome.reason] ?? 0) + 1;
      }
    }
  }

  return result;
}

/** Clear reminder markers when appointment time changes (reschedule). */
export const emailReminderClearData: Prisma.BookingUpdateInput = {
  emailReminderSentAt: null,
  emailReminderForStartAt: null,
};
