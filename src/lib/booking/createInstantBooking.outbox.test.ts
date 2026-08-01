import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, Prisma } from '@prisma/client';

const findUniqueBooking = vi.fn();
const findUniqueOrThrowBooking = vi.fn();
const findUniqueOrThrowService = vi.fn();
const findUniqueOrThrowShop = vi.fn();
const findUniqueShop = vi.fn();
const findUniqueBarber = vi.fn();
const findUniqueBarberService = vi.fn();
const transaction = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();
const buildInstantBookingConfirmationEmail = vi.fn();
const getShopPublicActivityPauseOnDate = vi.fn();

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findUnique: (...args: unknown[]) => findUniqueBooking(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowBooking(...args),
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
    barberTimeOff: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    shopOpeningHours: {
      findMany: vi.fn().mockResolvedValue([]),
    },
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
vi.mock('./depositGate', () => ({
  canCollectBookingDeposit: () => false,
  resolveBookingDepositPence: () => 0,
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

const serviceRow = {
  id: 'svc_1',
  shopId: 'shop_1',
  name: 'Cut',
  pricePence: 2000,
  durationMinutes: 30,
  bufferMinutes: 0,
  isActive: true,
};

const shopRow = {
  id: 'shop_1',
  name: 'Test Shop',
  shopPaidAt: new Date(),
  smsRemindersEnabled: false,
  depositsEnabled: false,
  stripeConnectAccountId: null,
  stripeConnectChargesEnabled: false,
  pendingConfirmationMins: 15,
  defaultBufferMinutes: 0,
  openingHours: null,
  timezone: 'Europe/London',
  rescheduleWindowHours: 24,
  cancellationWindowHours: 24,
  maxClientReschedules: 2,
};

describe('createInstantBooking outbox + idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getShopPublicActivityPauseOnDate.mockResolvedValue({ paused: false });
    buildInstantBookingConfirmationEmail.mockReturnValue({
      subject: 'Your booking is confirmed',
      html: '<p>ok</p>',
    });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
    enqueueEmail.mockResolvedValue({ id: 'out_1' });
    findUniqueOrThrowService.mockResolvedValue(serviceRow);
    findUniqueOrThrowShop.mockResolvedValue(shopRow);
    findUniqueShop.mockResolvedValue({ name: 'Test Shop' });
    findUniqueBarber.mockResolvedValue({
      id: 'barber_1',
      shopId: 'shop_1',
      name: 'Alex',
      active: true,
    });
    findUniqueBarberService.mockResolvedValue({ serviceId: 'svc_1' });
  });

  it('replays an existing booking for the same idempotency key without creating another', async () => {
    findUniqueBooking.mockResolvedValue({
      id: 'book_existing',
      status: BookingStatus.BOOKED,
      paymentRequired: false,
      serviceNameAtBooking: 'Cut',
      service: { name: 'Cut' },
      barber: { name: 'Alex' },
      email: 'a@example.com',
      fullName: 'A',
      startAt: new Date(),
    });

    const result = await createInstantBooking(
      {
        serviceId: 'svc_1',
        barberId: 'barber_1',
        date: '2026-08-10',
        time: '10:00',
        fullName: 'A Client',
        email: 'a@example.com',
        idempotencyKey: 'client-key-123456',
      },
      { requiredShopId: 'shop_1' },
    );

    expect(result.id).toBe('book_existing');
    expect(result.replayed).toBe(true);
    expect(result.manageToken).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
    expect(findUniqueBooking).toHaveBeenCalledWith({
      where: { idempotencyKey: 'shop_1:client-key-123456' },
      include: { service: true, barber: true },
    });
  });

  it('enqueues confirmation email in the same transaction and returns success even if deliver is attempted', async () => {
    findUniqueBooking.mockResolvedValue(null);

    const createdBooking = {
      id: 'book_new',
      status: BookingStatus.BOOKED,
      email: 'a@example.com',
      fullName: 'A Client',
      serviceNameAtBooking: 'Cut',
      service: { name: 'Cut' },
      barber: { name: 'Alex', shopId: 'shop_1' },
      startAt: new Date('2026-08-10T09:00:00.000Z'),
      paymentRequired: false,
    };

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(createdBooking),
        },
        barberTimeOff: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        client: {
          upsert: vi.fn().mockResolvedValue({ id: 'client_1' }),
        },
      };
      return fn(tx);
    });

    const result = await createInstantBooking(
      {
        serviceId: 'svc_1',
        barberId: 'barber_1',
        date: '2026-08-10',
        time: '10:00',
        fullName: 'A Client',
        email: 'a@example.com',
        idempotencyKey: 'new-key-abcdef',
      },
      { requiredShopId: 'shop_1' },
    );

    expect(result.id).toBe('book_new');
    expect(result.replayed).toBe(false);
    expect(typeof result.manageToken).toBe('string');
    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        shopId: 'shop_1',
        bookingId: 'book_new',
        purpose: 'BOOKING_CONFIRMATION',
        to: 'a@example.com',
      }),
    );
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('out_1');
  });

  it('handles P2002 on idempotency key by returning the existing booking', async () => {
    findUniqueBooking.mockResolvedValueOnce(null);

    const existing = {
      id: 'book_race',
      status: BookingStatus.BOOKED,
      paymentRequired: false,
      serviceNameAtBooking: 'Cut',
      service: { name: 'Cut' },
      barber: { name: 'Alex' },
      email: 'a@example.com',
      fullName: 'A',
      startAt: new Date(),
    };
    findUniqueOrThrowBooking.mockResolvedValue(existing);

    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['idempotencyKey'] },
    });
    transaction.mockRejectedValue(p2002);

    // After P2002 we look up by key then loadBookingForCreateResponse
    findUniqueBooking.mockResolvedValueOnce({ id: 'book_race' });
    // loadBookingForCreateResponse uses findUniqueOrThrow — already mocked above

    const result = await createInstantBooking(
      {
        serviceId: 'svc_1',
        barberId: 'barber_1',
        date: '2026-08-10',
        time: '10:00',
        fullName: 'A Client',
        email: 'a@example.com',
        idempotencyKey: 'race-key-123456',
      },
      { requiredShopId: 'shop_1' },
    );

    expect(result.id).toBe('book_race');
    expect(result.replayed).toBe(true);
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
  });
});
