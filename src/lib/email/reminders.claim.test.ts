import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REMINDER_CLAIM_SENTINEL,
  REMINDER_CLAIM_STALE_MS,
  reminderClaimStaleBefore,
} from '@/lib/booking/reminderClaim';

const {
  sendAppointmentReminderEmail,
  buildAppointmentReminderEmail,
  bookingFindMany,
  bookingUpdateMany,
  bookingUpdate,
  emailOutboundCreate,
  emailOutboundUpdate,
  prismaTransaction,
} = vi.hoisted(() => ({
  sendAppointmentReminderEmail: vi.fn(),
  buildAppointmentReminderEmail: vi.fn(() => ({
    subject: 'Reminder',
    html: '<p>x</p>',
    text: 'x',
  })),
  bookingFindMany: vi.fn(),
  bookingUpdateMany: vi.fn(),
  bookingUpdate: vi.fn(),
  emailOutboundCreate: vi.fn(),
  emailOutboundUpdate: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => bookingFindMany(...args),
      updateMany: (...args: unknown[]) => bookingUpdateMany(...args),
      update: (...args: unknown[]) => bookingUpdate(...args),
    },
    emailOutbound: {
      create: (...args: unknown[]) => emailOutboundCreate(...args),
      update: (...args: unknown[]) => emailOutboundUpdate(...args),
    },
    $transaction: (...args: unknown[]) => prismaTransaction(...args),
  },
}));

vi.mock('./sender', () => ({
  buildAppointmentReminderEmail,
  sendAppointmentReminderEmail,
  isEmailDeliveryConfigured: () => true,
  EmailDeliveryError: class EmailDeliveryError extends Error {},
}));

import {
  evaluateEmailReminderEligibility,
  findDueEmailReminders,
  reminderWindowBounds,
  sendAppointmentEmailReminder,
} from './reminders';

function dueCandidate(now: Date, overrides: Record<string, unknown> = {}) {
  const { windowStart } = reminderWindowBounds(now);
  const startAt = new Date(windowStart.getTime() + 30 * 60 * 1000);
  return {
    id: 'bk-email-1',
    shopId: 'shop-1',
    email: 'alex@example.com',
    fullName: 'Alex',
    startAt,
    createdAt: new Date(startAt.getTime() - 48 * 60 * 60 * 1000),
    notes: null as string | null,
    emailReminderSentAt: null as Date | null,
    emailReminderForStartAt: null as Date | null,
    shopPaidAt: new Date('2026-01-01T00:00:00.000Z'),
    shopName: 'Shop',
    shopTimezone: 'Europe/London',
    serviceName: 'Cut',
    barberName: 'Sam',
    ...overrides,
  };
}

describe('email reminder claim CAS / stale recovery', () => {
  const now = new Date('2026-09-23T12:00:00.000Z');
  const nowMs = now.getTime();

  beforeEach(() => {
    bookingFindMany.mockReset();
    bookingUpdateMany.mockReset();
    bookingUpdate.mockReset();
    emailOutboundCreate.mockReset();
    emailOutboundUpdate.mockReset();
    prismaTransaction.mockReset();
    sendAppointmentReminderEmail.mockReset();
    emailOutboundCreate.mockResolvedValue({ id: 'em-out-1' });
    emailOutboundUpdate.mockResolvedValue({});
    bookingUpdate.mockResolvedValue({});
    prismaTransaction.mockResolvedValue([]);
    vi.stubEnv('EMAIL_REMINDERS_ENABLED', 'true');
  });

  it('findDueEmailReminders selects null or stale Date(0) only', async () => {
    bookingFindMany.mockResolvedValue([]);
    await findDueEmailReminders(now, 10);
    const where = bookingFindMany.mock.calls[0]?.[0]?.where;
    expect(where.AND[0].OR).toEqual([
      { emailReminderSentAt: null },
      {
        AND: [
          { emailReminderSentAt: REMINDER_CLAIM_SENTINEL },
          { updatedAt: { lte: reminderClaimStaleBefore(nowMs) } },
        ],
      },
    ]);
  });

  it('NO CLAIM = NO SEND: CAS count 0 skips provider', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 0 });
    const result = await sendAppointmentEmailReminder(dueCandidate(now), now);
    expect(result).toEqual({ status: 'skipped', reason: 'already_sent' });
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
    expect(emailOutboundCreate).not.toHaveBeenCalled();
  });

  it('stale reclaim winner sends; finalisation uses real timestamp not Date(0)', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 1 });
    sendAppointmentReminderEmail.mockResolvedValue({ messageId: 're_1' });

    const candidate = dueCandidate(now, { emailReminderSentAt: REMINDER_CLAIM_SENTINEL });
    const result = await sendAppointmentEmailReminder(candidate, now);

    expect(result.status).toBe('sent');
    expect(sendAppointmentReminderEmail).toHaveBeenCalledTimes(1);
    expect(bookingUpdateMany.mock.calls[0]?.[0]?.data.emailReminderSentAt).toEqual(
      REMINDER_CLAIM_SENTINEL,
    );
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: candidate.id },
      data: {
        emailReminderSentAt: expect.any(Date),
        emailReminderForStartAt: candidate.startAt,
      },
    });
    const sentAt = bookingUpdate.mock.calls[0]?.[0]?.data?.emailReminderSentAt as Date;
    expect(sentAt.getTime()).not.toBe(0);
  });

  it('caught provider failure releases claim to null (retryable)', async () => {
    bookingUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    sendAppointmentReminderEmail.mockRejectedValue(new Error('resend down'));

    const result = await sendAppointmentEmailReminder(dueCandidate(now), now);
    expect(result.status).toBe('failed');
    expect(bookingUpdateMany.mock.calls[1]?.[0]?.data).toEqual({
      emailReminderSentAt: null,
      emailReminderForStartAt: null,
    });
  });

  it('eligibility: Date(0) sentinel is not treated as already_sent', () => {
    const result = evaluateEmailReminderEligibility(
      dueCandidate(now, { emailReminderSentAt: REMINDER_CLAIM_SENTINEL }),
      now,
      { enabled: true },
    );
    expect(result.ok).toBe(true);
  });

  it('CRASH MODEL: stale threshold matches shared REMINDER_CLAIM_STALE_MS', () => {
    expect(REMINDER_CLAIM_STALE_MS).toBe(15 * 60 * 1000);
  });

  it('loser of concurrent stale reclaim does not send (CAS)', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 0 });
    const result = await sendAppointmentEmailReminder(
      dueCandidate(now, { emailReminderSentAt: REMINDER_CLAIM_SENTINEL }),
      now,
    );
    expect(result.status).toBe('skipped');
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
  });
});
