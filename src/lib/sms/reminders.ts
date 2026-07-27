import { BookingStatus, SmsOutboundPurpose, SmsOutboundStatus, type Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '../booking/sandboxBookings';
import { getSmsProvider, isSmsRemindersEnabled } from './client';
import { normalizePhoneToE164 } from './phone';
import { buildAppointmentReminderBody } from './templates';
import { SmsDeliveryError, type SmsProvider } from './types';

/** Reminder window around T-24h (cron every 15m). */
export const REMINDER_WINDOW_MIN_MS = 23 * 60 * 60 * 1000;
export const REMINDER_WINDOW_MAX_MS = 25 * 60 * 60 * 1000;

export const DEFAULT_REMINDER_BATCH_LIMIT = 75;

/** Sentinel used while a send is in flight (cleared on failure). */
export const REMINDER_CLAIM_SENTINEL = new Date(0);

export type ReminderCandidate = {
  id: string;
  shopId: string;
  phone: string | null;
  fullName: string;
  startAt: Date;
  createdAt: Date;
  notes: string | null;
  smsReminderSentAt: Date | null;
  smsReminderForStartAt: Date | null;
  smsRemindersEnabled: boolean;
  shopName: string;
  shopTimezone: string;
  serviceName: string;
};

export type ReminderEligibilityReason =
  | 'ok'
  | 'kill_switch'
  | 'demo_shop'
  | 'shop_sms_disabled'
  | 'test_booking'
  | 'no_phone'
  | 'invalid_phone'
  | 'already_sent'
  | 'created_too_late'
  | 'outside_window';

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

export function evaluateReminderEligibility(
  candidate: Pick<
    ReminderCandidate,
    | 'shopId'
    | 'phone'
    | 'startAt'
    | 'createdAt'
    | 'notes'
    | 'smsReminderSentAt'
    | 'smsReminderForStartAt'
    | 'smsRemindersEnabled'
  >,
  now: Date,
  options?: { enabled?: boolean },
): { ok: true; toE164: string } | { ok: false; reason: ReminderEligibilityReason } {
  const enabled = options?.enabled ?? isSmsRemindersEnabled();
  if (!enabled) return { ok: false, reason: 'kill_switch' };
  if (candidate.shopId === DEMO_SHOP_ID) return { ok: false, reason: 'demo_shop' };
  if (!candidate.smsRemindersEnabled) return { ok: false, reason: 'shop_sms_disabled' };
  if (isSandboxBookingNotes(candidate.notes)) return { ok: false, reason: 'test_booking' };

  if (!candidate.phone?.trim()) return { ok: false, reason: 'no_phone' };
  const toE164 = normalizePhoneToE164(candidate.phone);
  if (!toE164) return { ok: false, reason: 'invalid_phone' };

  if (candidate.smsReminderSentAt != null) {
    return { ok: false, reason: 'already_sent' };
  }

  const { windowStart, windowEnd } = reminderWindowBounds(now);
  if (candidate.startAt < windowStart || candidate.startAt > windowEnd) {
    return { ok: false, reason: 'outside_window' };
  }

  // Skip if booking was created inside the reminder window (too late for a day-before SMS).
  const latestUsefulCreate = new Date(candidate.startAt.getTime() - REMINDER_WINDOW_MIN_MS);
  if (candidate.createdAt > latestUsefulCreate) {
    return { ok: false, reason: 'created_too_late' };
  }

  return { ok: true, toE164 };
}

export async function findDueReminders(
  now: Date = new Date(),
  limit: number = DEFAULT_REMINDER_BATCH_LIMIT,
): Promise<ReminderCandidate[]> {
  const { windowStart, windowEnd } = reminderWindowBounds(now);

  const rows = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      startAt: { gte: windowStart, lte: windowEnd },
      smsReminderSentAt: null,
      phone: { not: null },
      barber: {
        shopId: { not: DEMO_SHOP_ID },
        shop: { smsRemindersEnabled: true },
      },
      // Allow null/empty notes; Prisma `NOT notes = '[TEST]'` would drop NULLs.
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
      phone: true,
      fullName: true,
      startAt: true,
      createdAt: true,
      notes: true,
      smsReminderSentAt: true,
      smsReminderForStartAt: true,
      serviceNameAtBooking: true,
      barber: {
        select: {
          shopId: true,
          shop: { select: { name: true, timezone: true, smsRemindersEnabled: true } },
        },
      },
      service: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    shopId: row.barber.shopId,
    phone: row.phone,
    fullName: row.fullName,
    startAt: row.startAt,
    createdAt: row.createdAt,
    notes: row.notes,
    smsReminderSentAt: row.smsReminderSentAt,
    smsReminderForStartAt: row.smsReminderForStartAt,
    smsRemindersEnabled: row.barber.shop.smsRemindersEnabled,
    shopName: row.barber.shop.name,
    shopTimezone: row.barber.shop.timezone || 'Europe/London',
    serviceName: row.serviceNameAtBooking?.trim() || row.service.name,
  }));
}

export type ProcessRemindersResult = {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  skipReasons: Partial<Record<ReminderEligibilityReason, number>>;
};

async function claimReminderSend(bookingId: string, startAt: Date): Promise<boolean> {
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.BOOKED,
      startAt,
      smsReminderSentAt: null,
    },
    data: {
      smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
      smsReminderForStartAt: startAt,
    },
  });
  return result.count > 0;
}

async function releaseReminderClaim(bookingId: string): Promise<void> {
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
    },
    data: {
      smsReminderSentAt: null,
      smsReminderForStartAt: null,
    },
  });
}

export async function sendAppointmentReminder(
  candidate: ReminderCandidate,
  now: Date = new Date(),
  provider?: SmsProvider,
): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: ReminderEligibilityReason; error?: string }> {
  const eligibility = evaluateReminderEligibility(candidate, now);
  if (!eligibility.ok) {
    return { status: 'skipped', reason: eligibility.reason };
  }

  const claimed = await claimReminderSend(candidate.id, candidate.startAt);
  if (!claimed) {
    return { status: 'skipped', reason: 'already_sent' };
  }

  const body = buildAppointmentReminderBody({
    shopName: candidate.shopName,
    serviceName: candidate.serviceName,
    startAt: candidate.startAt,
    timezone: candidate.shopTimezone,
  });

  const outbound = await prisma.smsOutbound.create({
    data: {
      shopId: candidate.shopId,
      bookingId: candidate.id,
      toE164: eligibility.toE164,
      body,
      purpose: SmsOutboundPurpose.APPOINTMENT_REMINDER,
      provider: provider?.name ?? 'pending',
      status: SmsOutboundStatus.QUEUED,
    },
  });

  try {
    const sms = provider ?? getSmsProvider();
    const result = await sms.send({ toE164: eligibility.toE164, body });
    const sentAt = new Date();

    await prisma.$transaction([
      prisma.smsOutbound.update({
        where: { id: outbound.id },
        data: {
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          status: SmsOutboundStatus.SENT,
        },
      }),
      prisma.booking.update({
        where: { id: candidate.id },
        data: {
          smsReminderSentAt: sentAt,
          smsReminderForStartAt: candidate.startAt,
        },
      }),
    ]);

    return { status: 'sent' };
  } catch (error) {
    const message =
      error instanceof SmsDeliveryError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown SMS send error';

    await prisma.smsOutbound.update({
      where: { id: outbound.id },
      data: {
        status: SmsOutboundStatus.FAILED,
        error: message.slice(0, 500),
        provider: provider?.name ?? 'unknown',
      },
    });
    await releaseReminderClaim(candidate.id);

    console.error('[SMS] Appointment reminder failed', {
      bookingId: candidate.id,
      error: message,
    });

    return { status: 'failed', error: message };
  }
}

export async function processDueAppointmentReminders(
  now: Date = new Date(),
  options?: { limit?: number; provider?: SmsProvider },
): Promise<ProcessRemindersResult> {
  const result: ProcessRemindersResult = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    skipReasons: {},
  };

  if (!isSmsRemindersEnabled()) {
    result.skipReasons.kill_switch = 1;
    return result;
  }

  const due = await findDueReminders(now, options?.limit ?? DEFAULT_REMINDER_BATCH_LIMIT);
  result.scanned = due.length;

  for (const candidate of due) {
    const outcome = await sendAppointmentReminder(candidate, now, options?.provider);
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
export const smsReminderClearData: Prisma.BookingUpdateInput = {
  smsReminderSentAt: null,
  smsReminderForStartAt: null,
};
