import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, PaymentStatus } from '@prisma/client';

/**
 * Booking payment snapshot written by createInstantBooking, using the REAL depositGate
 * (legacy Paid-only deposit rules) so Free pay-at-shop behaviour is exercised end to end.
 */

const findUniqueBooking = vi.fn();
const findUniqueOrThrowService = vi.fn();
const findUniqueOrThrowShop = vi.fn();
const findUniqueShop = vi.fn();
const findUniqueBarber = vi.fn();
const findUniqueBarberService = vi.fn();
const transaction = vi.fn();
const bookingCreate = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();
const buildInstantBookingConfirmationEmail = vi.fn();
const getShopPublicActivityPauseOnDate = vi.fn();

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findUnique: (...args: unknown[]) => findUniqueBooking(...args),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    service: {
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowService(...args),
    },
    shopSettings: {
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowShop(...args),
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    barber: {
      findUnique: (...args: unknown[]) => findUniqueBarber(...args),
      findMany: vi.fn().mockResolvedValue([]),
    },
    barberService: {
      findUnique: (...args: unknown[]) => findUniqueBarberService(...args),
    },
    availabilityRule: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'rule_1', barberId: 'barber_1', dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 18 * 60, active: true },
      ]),
    },
    barberTimeOff: { findMany: vi.fn().mockResolvedValue([]) },
    shopOpeningHours: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('../db/resilience', () => ({
  PUBLIC_BOOKING_UNAVAILABLE_MESSAGE: 'unavailable',
  isPrismaQuotaExceededError: () => false,
}));

vi.mock('../db/timeBlocks', () => ({
  getTimeBlockDelegate: () => ({
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../email/sender', () => ({
  buildInstantBookingConfirmationEmail: (...args: unknown[]) =>
    buildInstantBookingConfirmationEmail(...args),
  buildRescheduledBookingEmail: vi.fn(),
  sendShopCancelledBookingEmail: vi.fn(),
}));

vi.mock('../email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

vi.mock('../sms/reminders', () => ({ smsReminderClearData: {} }));
vi.mock('../email/reminders', () => ({ emailReminderClearData: {} }));
vi.mock('@/lib/admin/shopOpeningHours', () => ({
  intersectMinutesWithShopDay: (x: unknown) => x,
}));
vi.mock('@/lib/admin/shopPublicActivity', () => ({
  getShopPublicActivityPauseOnDate: (...args: unknown[]) => getShopPublicActivityPauseOnDate(...args),
}));
vi.mock('./depositMoney', () => ({
  depositRefundClientMessage: () => '',
  forfeitBookingDeposit: vi.fn(),
  requestDepositRefund: vi.fn(),
  attemptDepositRefund: vi.fn(),
}));
vi.mock('./slots', () => ({
  generateSlots: () => ['10:00', '10:30', '11:00'],
}));

import { createInstantBooking } from './service';

const baseService = {
  id: 'svc_1',
  shopId: 'shop_1',
  name: 'Cut',
  pricePence: 2000,
  durationMinutes: 30,
  bufferMinutes: 0,
  isActive: true,
};

const baseShop = {
  id: 'shop_1',
  name: 'Test Shop',
  shopPaidAt: new Date('2026-01-01T00:00:00.000Z') as Date | null,
  smsRemindersEnabled: false,
  freeBookingActivatedAt: null as Date | null,
  depositsEnabled: true,
  stripeConnectAccountId: 'acct_ready' as string | null,
  stripeConnectChargesEnabled: true,
  pendingConfirmationMins: 15,
  defaultBufferMinutes: 0,
  openingHours: null,
  timezone: 'Europe/London',
  rescheduleWindowHours: 24,
  cancellationWindowHours: 24,
  maxClientReschedules: 2,
};

function bookingInput(key: string) {
  return {
    serviceId: 'svc_1',
    barberId: 'barber_1',
    date: '2026-08-10',
    time: '10:00',
    fullName: 'A Client',
    email: 'a@example.com',
    idempotencyKey: key,
  };
}

function createdData(): Record<string, unknown> {
  expect(bookingCreate).toHaveBeenCalledTimes(1);
  return bookingCreate.mock.calls[0][0].data as Record<string, unknown>;
}

describe('createInstantBooking — booking payment snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getShopPublicActivityPauseOnDate.mockResolvedValue({ paused: false });
    buildInstantBookingConfirmationEmail.mockReturnValue({ subject: 's', html: '<p>ok</p>' });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
    enqueueEmail.mockResolvedValue({ id: 'out_1' });
    findUniqueBooking.mockResolvedValue(null);
    findUniqueOrThrowService.mockResolvedValue(baseService);
    findUniqueShop.mockResolvedValue({ name: 'Test Shop' });
    findUniqueBarber.mockResolvedValue({ id: 'barber_1', shopId: 'shop_1', name: 'Alex', active: true });
    findUniqueBarberService.mockResolvedValue({ serviceId: 'svc_1' });
    bookingCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'book_new',
      email: 'a@example.com',
      fullName: 'A Client',
      serviceNameAtBooking: 'Cut',
      service: { name: 'Cut' },
      barber: { name: 'Alex', shopId: 'shop_1' },
      startAt: new Date('2026-08-10T09:00:00.000Z'),
      ...data,
    }));
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        booking: { findFirst: vi.fn().mockResolvedValue(null), create: bookingCreate },
        barberTimeOff: { findFirst: vi.fn().mockResolvedValue(null) },
        client: { upsert: vi.fn().mockResolvedValue({ id: 'client_1' }) },
      }),
    );
  });

  it('P: Paid shop deposit booking snapshots DEPOSIT / deposit amount / 0 bps / 0 fee (legacy flow unchanged)', async () => {
    findUniqueOrThrowShop.mockResolvedValue(baseShop);

    const result = await createInstantBooking(bookingInput('paid-deposit-key'), {
      requiredShopId: 'shop_1',
      allowDepositCollection: true,
    });

    const data = createdData();
    expect(data).toMatchObject({
      status: BookingStatus.PENDING_PAYMENT,
      paymentRequired: true,
      depositAmountPence: 500,
      paymentStatus: PaymentStatus.UNPAID,
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 500,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
    expect(data.paymentExpiresAt).toBeInstanceOf(Date);
    expect(result.depositRequired).toBe(true);
    // Confirmation email still waits for payment.
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('P: deposit on a sub-£5 service snapshots the service price', async () => {
    findUniqueOrThrowShop.mockResolvedValue(baseShop);
    findUniqueOrThrowService.mockResolvedValue({ ...baseService, pricePence: 300 });

    await createInstantBooking(bookingInput('paid-cheap-key'), {
      requiredShopId: 'shop_1',
      allowDepositCollection: true,
    });

    expect(createdData()).toMatchObject({
      depositAmountPence: 300,
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 300,
      kersivoPlatformFeePence: 0,
    });
  });

  it('non-payment booking snapshots NONE / 0 / 0 / 0', async () => {
    findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, depositsEnabled: false });

    await createInstantBooking(bookingInput('paid-no-deposit-key'), {
      requiredShopId: 'shop_1',
      allowDepositCollection: true,
    });

    expect(createdData()).toMatchObject({
      status: BookingStatus.BOOKED,
      paymentRequired: false,
      depositAmountPence: null,
      paymentStatus: null,
      paymentExpiresAt: null,
      bookingPaymentType: 'NONE',
      paymentAmountPence: 0,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
  });

  it('Q: Free shop with stale depositsEnabled + ready Connect stays pay-at-shop (no Stripe deposit, BOOKED)', async () => {
    findUniqueOrThrowShop.mockResolvedValue({
      ...baseShop,
      shopPaidAt: null,
      smsRemindersEnabled: false,
      freeBookingActivatedAt: new Date('2026-10-04T09:00:00.000Z'),
      depositsEnabled: true,
      stripeConnectAccountId: 'acct_free_ready',
      stripeConnectChargesEnabled: true,
    });

    const result = await createInstantBooking(bookingInput('free-key'), {
      requiredShopId: 'shop_1',
      allowDepositCollection: true,
    });

    expect(result.depositRequired).toBe(false);
    expect(createdData()).toMatchObject({
      status: BookingStatus.BOOKED,
      paymentRequired: false,
      depositAmountPence: null,
      paymentStatus: null,
      paymentExpiresAt: null,
      bookingPaymentType: 'NONE',
      paymentAmountPence: 0,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
    // Pay-at-shop confirmation is sent immediately, exactly as before.
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });
});
