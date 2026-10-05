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
  bookingPaymentRefundClientMessage: () => '',
  forfeitBookingDeposit: vi.fn(),
  requestBookingPaymentRefund: vi.fn(),
  attemptBookingPaymentRefund: vi.fn(),
}));
vi.mock('./slots', () => ({
  generateSlots: () => ['10:00', '10:30', '11:00'],
}));

/** Shared shop row state, mutated only by "committed" Leave / booking transactions. */
const world: { departure: 'WINDING_DOWN' | 'RETENTION' | null; bookings: string[] } = {
  departure: null,
  bookings: [],
};
const events: string[] = [];
const loadKersivoAccess = vi.fn();

vi.mock('@/lib/shop/kersivoAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shop/kersivoAccess')>();
  return {
    ...actual,
    loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
  };
});

import {
  DEPARTURE_WIND_DOWN_CAPABILITIES,
  PRODUCT_STATE_CAPABILITIES,
  type KersivoAccess,
} from '@/lib/shop/kersivoAccess';
import { createInstantBooking } from './service';
import { SHOP_NOT_ACCEPTING_NEW_BOOKINGS } from './bookingCreationGate';

function accessFromWorld(): KersivoAccess {
  if (world.departure === 'WINDING_DOWN') {
    return { state: 'SETUP', capabilities: DEPARTURE_WIND_DOWN_CAPABILITIES, departure: 'WINDING_DOWN' };
  }
  if (world.departure === 'RETENTION') {
    return { state: 'SETUP', capabilities: PRODUCT_STATE_CAPABILITIES.SETUP, departure: 'RETENTION' };
  }
  return { state: 'FREE_BOOKING', capabilities: PRODUCT_STATE_CAPABILITIES.FREE_BOOKING };
}

/** Mirrors requestStarterDeparture's decision under the same ShopSettings lock. */
function leaveKersivoCommit() {
  events.push('leave:lock');
  world.departure = world.bookings.length > 0 ? 'WINDING_DOWN' : 'RETENTION';
}

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

const bookingInput = {
  serviceId: 'svc_1',
  barberId: 'barber_1',
  date: '2026-08-10',
  time: '10:00',
  fullName: 'A Client',
  email: 'a@example.com',
};

let bookingCreate: ReturnType<typeof vi.fn>;
let queryRaw: ReturnType<typeof vi.fn>;

describe('createInstantBooking final departure / capability gate (P0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.departure = null;
    world.bookings = [];
    events.length = 0;
    getShopPublicActivityPauseOnDate.mockResolvedValue({ paused: false });
    buildInstantBookingConfirmationEmail.mockReturnValue({ subject: 's', html: '<p>ok</p>' });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
    enqueueEmail.mockResolvedValue({ id: 'out_1' });
    findUniqueOrThrowService.mockResolvedValue(serviceRow);
    findUniqueOrThrowShop.mockResolvedValue(shopRow);
    findUniqueShop.mockResolvedValue({ name: 'Test Shop' });
    findUniqueBarber.mockResolvedValue({ id: 'barber_1', shopId: 'shop_1', name: 'Alex', active: true });
    findUniqueBarberService.mockResolvedValue({ serviceId: 'svc_1' });
    findUniqueBooking.mockResolvedValue(null);
    loadKersivoAccess.mockImplementation(async () => {
      events.push('booking:access-check');
      return accessFromWorld();
    });

    queryRaw = vi.fn(async () => {
      events.push('booking:lock');
      return [];
    });
    bookingCreate = vi.fn(async () => {
      events.push('booking:insert');
      world.bookings.push('book_new');
      return {
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
    });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: queryRaw,
        booking: { findFirst: vi.fn().mockResolvedValue(null), create: bookingCreate },
        barberTimeOff: { findFirst: vi.fn().mockResolvedValue(null) },
        client: { upsert: vi.fn().mockResolvedValue({ id: 'client_1' }) },
      }),
    );
  });

  it('9 + 13: Leave commits first → public booking is refused inside the transaction, nothing inserted', async () => {
    leaveKersivoCommit();
    await expect(
      createInstantBooking(bookingInput, { requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' }),
    ).rejects.toMatchObject({ statusCode: 403, code: SHOP_NOT_ACCEPTING_NEW_BOOKINGS });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(bookingCreate).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(world.bookings).toEqual([]);
  });

  it('10: booking commits first → the later Leave sees it and enters WINDING_DOWN', async () => {
    await createInstantBooking(bookingInput, { requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' });
    leaveKersivoCommit();
    expect(world.departure).toBe('WINDING_DOWN');
    expect(events).toEqual(['booking:lock', 'booking:access-check', 'booking:insert', 'leave:lock']);
  });

  it('the lock and capability check run before the slot check and the insert, on the tx client', async () => {
    await createInstantBooking(bookingInput, { requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' });
    const [sql] = queryRaw.mock.calls[0] as unknown as [{ strings: string[] }];
    expect(sql.strings.join('?')).toContain('FOR UPDATE');
    expect(loadKersivoAccess).toHaveBeenCalledWith('shop_1', expect.any(Date), expect.objectContaining({ $queryRaw: queryRaw }));
    expect(events.indexOf('booking:access-check')).toBeLessThan(events.indexOf('booking:insert'));
  });

  it('11: WINDING_DOWN still refuses a NEW public booking', async () => {
    world.departure = 'WINDING_DOWN';
    await expect(
      createInstantBooking(bookingInput, { requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' }),
    ).rejects.toMatchObject({ code: SHOP_NOT_ACCEPTING_NEW_BOOKINGS });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it.each(['WINDING_DOWN', 'RETENTION'] as const)('12: manual/admin booking during %s is refused', async (status) => {
    world.departure = status;
    await expect(
      createInstantBooking(bookingInput, { requiredShopId: 'shop_1', requiredCapability: 'MANUAL_BOOKINGS' }),
    ).rejects.toMatchObject({ statusCode: 403, code: SHOP_NOT_ACCEPTING_NEW_BOOKINGS });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('14: idempotent replay of a pre-departure booking returns it, and never inserts after departure', async () => {
    world.departure = 'WINDING_DOWN';
    findUniqueBooking.mockResolvedValue({
      id: 'book_pre',
      status: BookingStatus.PENDING_PAYMENT,
      paymentRequired: true,
      serviceNameAtBooking: 'Cut',
      service: { name: 'Cut' },
      barber: { name: 'Alex' },
      email: 'a@example.com',
      fullName: 'A',
      startAt: new Date(),
    });
    const result = await createInstantBooking(
      { ...bookingInput, idempotencyKey: 'pre-departure-key' },
      { requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' },
    );
    expect(result).toMatchObject({ id: 'book_pre', replayed: true });
    expect(transaction).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();

    findUniqueBooking.mockResolvedValue(null);
    await expect(
      createInstantBooking(
        { ...bookingInput, idempotencyKey: 'post-departure-key' },
        { requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' },
      ),
    ).rejects.toMatchObject({ code: SHOP_NOT_ACCEPTING_NEW_BOOKINGS });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('15: a refused create never touches existing bookings (no update / delete on the tx)', async () => {
    world.departure = 'RETENTION';
    const update = vi.fn();
    const del = vi.fn();
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: queryRaw,
        booking: { findFirst: vi.fn(), create: bookingCreate, update, delete: del, updateMany: update, deleteMany: del },
        barberTimeOff: { findFirst: vi.fn() },
        client: { upsert: vi.fn() },
      }),
    );
    await expect(
      createInstantBooking(bookingInput, { requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' }),
    ).rejects.toMatchObject({ code: SHOP_NOT_ACCEPTING_NEW_BOOKINGS });
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('an active Starter shop still books normally through the gate', async () => {
    const result = await createInstantBooking(bookingInput, {
      requiredShopId: 'shop_1',
      requiredCapability: 'PUBLIC_BOOKING',
    });
    expect(result).toMatchObject({ id: 'book_new', replayed: false });
  });
});

