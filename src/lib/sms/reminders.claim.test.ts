import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REMINDER_CLAIM_SENTINEL,
  REMINDER_CLAIM_STALE_MS,
  reminderClaimStaleBefore,
} from '@/lib/booking/reminderClaim';

const { mockSend, bookingFindMany, bookingUpdateMany, bookingUpdate, smsOutboundCreate, smsOutboundUpdate, prismaTransaction } =
  vi.hoisted(() => ({
    mockSend: vi.fn(),
    bookingFindMany: vi.fn(),
    bookingUpdateMany: vi.fn(),
    bookingUpdate: vi.fn(),
    smsOutboundCreate: vi.fn(),
    smsOutboundUpdate: vi.fn(),
    prismaTransaction: vi.fn(),
  }));

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => bookingFindMany(...args),
      updateMany: (...args: unknown[]) => bookingUpdateMany(...args),
      update: (...args: unknown[]) => bookingUpdate(...args),
    },
    smsOutbound: {
      create: (...args: unknown[]) => smsOutboundCreate(...args),
      update: (...args: unknown[]) => smsOutboundUpdate(...args),
    },
    $transaction: (...args: unknown[]) => prismaTransaction(...args),
  },
}));

vi.mock('./client', () => ({
  isSmsRemindersEnabled: () => true,
  getSmsProvider: () => ({
    name: 'mock-sms',
    send: mockSend,
  }),
}));

import {
  evaluateReminderEligibility,
  findDueReminders,
  reminderWindowBounds,
  sendAppointmentReminder,
} from './reminders';

function dueCandidate(now: Date, overrides: Record<string, unknown> = {}) {
  const { windowStart } = reminderWindowBounds(now);
  const startAt = new Date(windowStart.getTime() + 30 * 60 * 1000);
  return {
    id: 'bk-sms-1',
    shopId: 'shop-1',
    phone: '07123456789',
    fullName: 'Alex',
    startAt,
    createdAt: new Date(startAt.getTime() - 48 * 60 * 60 * 1000),
    notes: null as string | null,
    smsReminderSentAt: null as Date | null,
    smsReminderForStartAt: null as Date | null,
    smsRemindersEnabled: true,
    shopName: 'Shop',
    shopTimezone: 'Europe/London',
    serviceName: 'Cut',
    ...overrides,
  };
}

describe('SMS reminder claim CAS / stale recovery', () => {
  const now = new Date('2026-09-23T12:00:00.000Z');
  const nowMs = now.getTime();

  beforeEach(() => {
    bookingFindMany.mockReset();
    bookingUpdateMany.mockReset();
    bookingUpdate.mockReset();
    smsOutboundCreate.mockReset();
    smsOutboundUpdate.mockReset();
    prismaTransaction.mockReset();
    mockSend.mockReset();
    smsOutboundCreate.mockResolvedValue({ id: 'out-1' });
    smsOutboundUpdate.mockResolvedValue({});
    bookingUpdate.mockResolvedValue({});
    prismaTransaction.mockResolvedValue([]);
  });

  it('findDueReminders selects null or stale Date(0) only (not recent claims)', async () => {
    bookingFindMany.mockResolvedValue([]);
    await findDueReminders(now, 10);
    const where = bookingFindMany.mock.calls[0]?.[0]?.where;
    expect(where.AND[0].OR).toEqual([
      { smsReminderSentAt: null },
      {
        AND: [
          { smsReminderSentAt: REMINDER_CLAIM_SENTINEL },
          { updatedAt: { lte: reminderClaimStaleBefore(nowMs) } },
        ],
      },
    ]);
  });

  it('NO CLAIM = NO SEND: CAS count 0 skips provider', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 0 });
    const result = await sendAppointmentReminder(dueCandidate(now), now);
    expect(result).toEqual({ status: 'skipped', reason: 'already_sent' });
    expect(mockSend).not.toHaveBeenCalled();
    expect(smsOutboundCreate).not.toHaveBeenCalled();
  });

  it('stale Date(0) reclaim winner sends; success finalises via booking.update', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 1 });
    mockSend.mockResolvedValue({
      provider: 'mock-sms',
      providerMessageId: 'SM1',
    });

    const candidate = dueCandidate(now, {
      smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
    });
    const result = await sendAppointmentReminder(candidate, now);

    expect(result.status).toBe('sent');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(bookingUpdateMany.mock.calls[0]?.[0]?.data).toEqual({
      smsReminderSentAt: REMINDER_CLAIM_SENTINEL,
      smsReminderForStartAt: candidate.startAt,
    });
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: candidate.id },
      data: {
        smsReminderSentAt: expect.any(Date),
        smsReminderForStartAt: candidate.startAt,
      },
    });
    const sentAt = bookingUpdate.mock.calls[0]?.[0]?.data?.smsReminderSentAt as Date;
    expect(sentAt.getTime()).not.toBe(0);
  });

  it('caught provider failure releases claim to null (retryable)', async () => {
    bookingUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mockSend.mockRejectedValue(new Error('provider down'));

    const result = await sendAppointmentReminder(dueCandidate(now), now);
    expect(result.status).toBe('failed');
    expect(bookingUpdateMany.mock.calls[1]?.[0]?.data).toEqual({
      smsReminderSentAt: null,
      smsReminderForStartAt: null,
    });
  });

  it('eligibility: Date(0) sentinel is not treated as already_sent', () => {
    const result = evaluateReminderEligibility(
      dueCandidate(now, { smsReminderSentAt: REMINDER_CLAIM_SENTINEL }),
      now,
      { enabled: true },
    );
    expect(result.ok).toBe(true);
  });

  it('CRASH MODEL: stale threshold is 15m (above provider/serverless budgets)', () => {
    expect(REMINDER_CLAIM_STALE_MS).toBe(15 * 60 * 1000);
    const staleUpdatedAt = new Date(nowMs - REMINDER_CLAIM_STALE_MS - 1);
    expect(staleUpdatedAt.getTime()).toBeLessThanOrEqual(reminderClaimStaleBefore(nowMs).getTime());
  });

  it('loser of concurrent stale reclaim does not send (CAS)', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 0 });
    const result = await sendAppointmentReminder(
      dueCandidate(now, { smsReminderSentAt: REMINDER_CLAIM_SENTINEL }),
      now,
    );
    expect(result.status).toBe('skipped');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
