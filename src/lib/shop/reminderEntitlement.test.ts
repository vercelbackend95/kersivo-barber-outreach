import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bookingFindMany,
  bookingUpdateMany,
  bookingUpdate,
  shopFindUnique,
  subscriptionFindFirst,
  outboundCreate,
  outboundUpdate,
  prismaTransaction,
  smsSend,
  sendAppointmentReminderEmail,
} = vi.hoisted(() => ({
  bookingFindMany: vi.fn(),
  bookingUpdateMany: vi.fn(),
  bookingUpdate: vi.fn(),
  shopFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  outboundCreate: vi.fn(),
  outboundUpdate: vi.fn(),
  prismaTransaction: vi.fn(),
  smsSend: vi.fn(),
  sendAppointmentReminderEmail: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: {
      findMany: (...a: unknown[]) => bookingFindMany(...a),
      updateMany: (...a: unknown[]) => bookingUpdateMany(...a),
      update: (...a: unknown[]) => bookingUpdate(...a),
    },
    shopSettings: { findUnique: (...a: unknown[]) => shopFindUnique(...a) },
    saasSubscription: { findFirst: (...a: unknown[]) => subscriptionFindFirst(...a) },
    smsOutbound: {
      create: (...a: unknown[]) => outboundCreate(...a),
      update: (...a: unknown[]) => outboundUpdate(...a),
    },
    emailOutbound: {
      create: (...a: unknown[]) => outboundCreate(...a),
      update: (...a: unknown[]) => outboundUpdate(...a),
    },
    $transaction: (...a: unknown[]) => prismaTransaction(...a),
  },
}));

vi.mock('@/lib/sms/client', () => ({
  isSmsRemindersEnabled: () => true,
  getSmsProvider: () => ({ name: 'mock-sms', send: smsSend }),
}));

vi.mock('@/lib/email/sender', () => ({
  buildAppointmentReminderEmail: () => ({ subject: 'Reminder', html: '<p>x</p>', text: 'x' }),
  sendAppointmentReminderEmail,
  isEmailDeliveryConfigured: () => true,
  EmailDeliveryError: class EmailDeliveryError extends Error {},
}));

import { processDueAppointmentReminders, reminderWindowBounds } from '@/lib/sms/reminders';
import { processDueAppointmentEmailReminders } from '@/lib/email/reminders';
import { shopCapabilityChecker } from './kersivoAccess';

const now = new Date('2026-10-04T12:00:00.000Z');
const FREE_SHOP = 'shop-free';
const FULL_SHOP = 'shop-full';

/** Free shop still carrying stale paid-era booleans (smsRemindersEnabled / shopPaidAt). */
const shops: Record<string, Record<string, unknown>> = {
  [FREE_SHOP]: {
    id: FREE_SHOP,
    shopPaidAt: new Date('2026-01-01T00:00:00.000Z'),
    smsRemindersEnabled: true,
    freeBookingActivatedAt: new Date('2026-09-01T00:00:00.000Z'),
  },
  [FULL_SHOP]: {
    id: FULL_SHOP,
    shopPaidAt: new Date('2026-01-01T00:00:00.000Z'),
    smsRemindersEnabled: true,
    freeBookingActivatedAt: null,
  },
};

const subscriptions: Record<string, Record<string, unknown>> = {
  [FREE_SHOP]: {
    status: 'CANCELED',
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    pastDueSince: null,
    cancelAtPeriodEnd: false,
  },
  [FULL_SHOP]: {
    status: 'ACTIVE',
    currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z'),
    pastDueSince: null,
    cancelAtPeriodEnd: false,
  },
};

function dueRow(id: string, shopId: string) {
  const { windowStart } = reminderWindowBounds(now);
  const startAt = new Date(windowStart.getTime() + 30 * 60 * 1000);
  return {
    id,
    phone: '07123456789',
    email: 'alex@example.com',
    fullName: 'Alex',
    startAt,
    createdAt: new Date(startAt.getTime() - 48 * 60 * 60 * 1000),
    notes: null,
    smsReminderSentAt: null,
    smsReminderForStartAt: null,
    emailReminderSentAt: null,
    emailReminderForStartAt: null,
    serviceNameAtBooking: 'Cut',
    barber: {
      name: 'Sam',
      shopId,
      shop: {
        name: 'Shop',
        timezone: 'Europe/London',
        smsRemindersEnabled: true,
        shopPaidAt: shops[shopId]!.shopPaidAt,
      },
    },
    service: { name: 'Cut' },
  };
}

describe('paid reminders respect the current product capability (P)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopFindUnique.mockImplementation(async (args: { where: { id: string } }) => shops[args.where.id] ?? null);
    subscriptionFindFirst.mockImplementation(
      async (args: { where: { shopId: string } }) => subscriptions[args.where.shopId] ?? null,
    );
    bookingUpdateMany.mockResolvedValue({ count: 1 });
    bookingUpdate.mockResolvedValue({});
    outboundCreate.mockResolvedValue({ id: 'out-1' });
    outboundUpdate.mockResolvedValue({});
    prismaTransaction.mockResolvedValue([]);
    smsSend.mockResolvedValue({ provider: 'mock-sms', providerMessageId: 'SM1' });
    sendAppointmentReminderEmail.mockResolvedValue({ provider: 'mock-email', providerMessageId: 'EM1' });
  });

  it('skips SMS for a Free shop with a stale smsRemindersEnabled flag; Full still sends', async () => {
    bookingFindMany.mockResolvedValue([dueRow('bk-free', FREE_SHOP), dueRow('bk-full', FULL_SHOP)]);

    const result = await processDueAppointmentReminders(now);

    expect(result.skipReasons.not_entitled).toBe(1);
    expect(result.sent).toBe(1);
    expect(smsSend).toHaveBeenCalledTimes(1);
    const claimedIds = bookingUpdateMany.mock.calls.map((call) => (call[0] as { where: { id: string } }).where.id);
    expect(claimedIds).not.toContain('bk-free');
  });

  it('skips automated email reminders for a Free shop with a stale shopPaidAt; Full still sends', async () => {
    bookingFindMany.mockResolvedValue([dueRow('bk-free', FREE_SHOP), dueRow('bk-full', FULL_SHOP)]);

    const result = await processDueAppointmentEmailReminders(now);

    expect(result.skipReasons.not_entitled).toBe(1);
    expect(result.sent).toBe(1);
    expect(sendAppointmentReminderEmail).toHaveBeenCalledTimes(1);
  });

  it('shopCapabilityChecker resolves each shop once per run', async () => {
    const isEntitled = shopCapabilityChecker('SMS_REMINDERS', now);
    expect(await isEntitled(FREE_SHOP)).toBe(false);
    expect(await isEntitled(FREE_SHOP)).toBe(false);
    expect(await isEntitled(FULL_SHOP)).toBe(true);
    expect(shopFindUnique).toHaveBeenCalledTimes(2);
  });
});
