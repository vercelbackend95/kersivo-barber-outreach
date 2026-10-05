import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, PaymentStatus } from '@prisma/client';

/**
 * Live booking payment runtime in createInstantBooking:
 * - v1.19 Starter uses the fixed customer DEPOSIT/FULL choice and ignores editable shop mode;
 * - Full uses ShopSettings.bookingPaymentMode.
 * The resolved payment is snapshotted onto the Booking before Checkout.
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
const loadKersivoAccess = vi.fn();

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
  bookingPaymentRefundClientMessage: () => '',
  forfeitBookingDeposit: vi.fn(),
  requestBookingPaymentRefund: vi.fn(),
  attemptBookingPaymentRefund: vi.fn(),
}));
vi.mock('./slots', () => ({
  generateSlots: () => ['10:00', '10:30', '11:00'],
}));
vi.mock('../shop/kersivoAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shop/kersivoAccess')>()),
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
}));

import { DEMO_SHOP_ID } from '../db/shopScope';
import { accessForState, type KersivoProductState } from '../shop/kersivoAccess';
import { BookingActionError, createInstantBooking } from './service';

function asState(state: KersivoProductState) {
  loadKersivoAccess.mockResolvedValue(accessForState(state));
}

const baseService = {
  id: 'svc_1',
  shopId: 'shop_1',
  name: 'Cut',
  pricePence: 3000,
  durationMinutes: 30,
  bufferMinutes: 0,
  isActive: true,
};

const baseShop = {
  id: 'shop_1',
  name: 'Test Shop',
  bookingPaymentMode: 'DEPOSIT' as 'NONE' | 'DEPOSIT' | 'FULL',
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

function bookingInput(key: string, paymentChoice: 'DEPOSIT' | 'FULL' = 'DEPOSIT') {
  return {
    serviceId: 'svc_1',
    barberId: 'barber_1',
    date: '2026-08-10',
    time: '10:00',
    fullName: 'A Client',
    email: 'a@example.com',
    idempotencyKey: key,
    paymentChoice,
  };
}

const publicOptions = { requiredShopId: 'shop_1', allowDepositCollection: true };

function createdData(): Record<string, unknown> {
  expect(bookingCreate).toHaveBeenCalledTimes(1);
  return bookingCreate.mock.calls[0][0].data as Record<string, unknown>;
}

const NONE_SNAPSHOT = {
  status: BookingStatus.BOOKED,
  paymentRequired: false,
  depositAmountPence: null,
  paymentStatus: null,
  paymentExpiresAt: null,
  bookingPaymentType: 'NONE',
  paymentAmountPence: 0,
  kersivoPlatformFeeBps: 0,
  kersivoPlatformFeePence: 0,
  stripeConnectAccountIdAtPayment: null,
};

describe('createInstantBooking — live booking payment runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asState('FREE_BOOKING');
    getShopPublicActivityPauseOnDate.mockResolvedValue({ paused: false });
    buildInstantBookingConfirmationEmail.mockReturnValue({ subject: 's', html: '<p>ok</p>' });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
    enqueueEmail.mockResolvedValue({ id: 'out_1' });
    findUniqueBooking.mockResolvedValue(null);
    findUniqueOrThrowService.mockResolvedValue(baseService);
    findUniqueOrThrowShop.mockResolvedValue(baseShop);
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

  it('A: Starter + DEPOSIT + £30 → PENDING_PAYMENT, 500p payment, 0% / 0p KERSIVO fee', async () => {
    const result = await createInstantBooking(bookingInput('free-30'), publicOptions);

    expect(loadKersivoAccess).toHaveBeenCalledWith('shop_1');
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

  describe('payment account snapshot', () => {
    it('F: new Starter DEPOSIT booking snapshots the exact connected account in the create', async () => {
      findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, stripeConnectAccountId: 'acct_free_exact' });

      await createInstantBooking(bookingInput('free-acct'), publicOptions);

      expect(createdData()).toMatchObject({
        status: BookingStatus.PENDING_PAYMENT,
        kersivoPlatformFeePence: 0,
        stripeConnectAccountIdAtPayment: 'acct_free_exact',
      });
      // One payment-state read decides collection AND supplies the account snapshot.
      const paymentReads = findUniqueOrThrowShop.mock.calls.filter(
        ([args]) => (args as { select?: Record<string, unknown> }).select?.bookingPaymentMode,
      );
      expect(paymentReads).toHaveLength(1);
      expect(paymentReads[0][0]).toMatchObject({
        select: expect.objectContaining({ stripeConnectAccountId: true, stripeConnectChargesEnabled: true }),
      });
    });

    it('G: new Full DEPOSIT booking snapshots the exact connected account', async () => {
      asState('FULL_KERSIVO');
      findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, stripeConnectAccountId: 'acct_full_exact' });

      await createInstantBooking(bookingInput('full-acct'), publicOptions);

      expect(createdData()).toMatchObject({
        kersivoPlatformFeePence: 0,
        stripeConnectAccountIdAtPayment: 'acct_full_exact',
      });
    });

    it('H: Full NONE booking has a null payment-account snapshot', async () => {
      asState('FULL_KERSIVO');
      findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, bookingPaymentMode: 'NONE' });

      await createInstantBooking(bookingInput('none-acct'), publicOptions);

      expect(createdData()).toMatchObject({ stripeConnectAccountIdAtPayment: null });
    });
  });

  it('B: Starter rejects a public service below the £5 minimum before creating a booking', async () => {
    findUniqueOrThrowService.mockResolvedValue({ ...baseService, pricePence: 300 });

    await expect(
      createInstantBooking(bookingInput('free-3'), publicOptions),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'STARTER_SERVICE_PRICE_TOO_LOW',
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('C: Starter ignores stored NONE / Pay-at-shop and still collects the customer-selected £5 deposit', async () => {
    findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, bookingPaymentMode: 'NONE' });

    const result = await createInstantBooking(bookingInput('free-none'), publicOptions);

    expect(result.depositRequired).toBe(true);
    expect(createdData()).toMatchObject({
      status: BookingStatus.PENDING_PAYMENT,
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 500,
      kersivoPlatformFeePence: 0,
    });
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(loadKersivoAccess).toHaveBeenCalledWith('shop_1');
  });

  it('C2: Starter above £5 fails closed when the customer payment choice is missing', async () => {
    const input = bookingInput('free-choice-required');
    delete (input as { paymentChoice?: string }).paymentChoice;

    await expect(createInstantBooking(input, publicOptions)).rejects.toMatchObject({
      statusCode: 400,
      code: 'STARTER_PAYMENT_CHOICE_REQUIRED',
    });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('C3: exactly £5 on Starter becomes one FULL £5 payment, not a deposit', async () => {
    findUniqueOrThrowService.mockResolvedValue({ ...baseService, pricePence: 500 });

    await createInstantBooking(bookingInput('free-exact-5', 'DEPOSIT'), publicOptions);

    expect(createdData()).toMatchObject({
      status: BookingStatus.PENDING_PAYMENT,
      bookingPaymentType: 'FULL',
      paymentAmountPence: 500,
      depositAmountPence: null,
      kersivoPlatformFeePence: 0,
    });
  });

  it('D / AC: Full + DEPOSIT → 500p, 0 bps, 0 fee (existing Paid deposit behaviour)', async () => {
    asState('FULL_KERSIVO');

    const result = await createInstantBooking(bookingInput('full-30'), publicOptions);

    expect(result.depositRequired).toBe(true);
    expect(createdData()).toMatchObject({
      status: BookingStatus.PENDING_PAYMENT,
      paymentRequired: true,
      depositAmountPence: 500,
      paymentStatus: PaymentStatus.UNPAID,
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 500,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
  });

  it('E: SETUP shop with DEPOSIT mode cannot take booking payment (fails closed, no booking)', async () => {
    asState('SETUP');

    await expect(createInstantBooking(bookingInput('setup'), publicOptions)).rejects.toMatchObject({
      statusCode: 503,
      code: 'BOOKING_PAYMENT_NOT_READY',
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('F: DEPOSIT with Connect missing / not ready fails closed before any booking is created', async () => {
    for (const shop of [
      { ...baseShop, stripeConnectAccountId: null },
      { ...baseShop, stripeConnectChargesEnabled: false },
    ]) {
      findUniqueOrThrowShop.mockResolvedValue(shop);
      const error = await createInstantBooking(bookingInput('no-connect'), publicOptions).catch((e) => e);
      expect(error).toBeInstanceOf(BookingActionError);
      expect(error).toMatchObject({ statusCode: 503, code: 'BOOKING_PAYMENT_NOT_READY' });
    }
    expect(transaction).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('F: demo shop never takes booking payments', async () => {
    findUniqueOrThrowService.mockResolvedValue({ ...baseService, shopId: DEMO_SHOP_ID });
    findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, id: DEMO_SHOP_ID });
    findUniqueBarber.mockResolvedValue({ id: 'barber_1', shopId: DEMO_SHOP_ID, name: 'Alex', active: true });
    asState('FULL_KERSIVO');

    await expect(createInstantBooking(bookingInput('demo'), { allowDepositCollection: true })).rejects.toMatchObject({
      code: 'BOOKING_PAYMENT_NOT_READY',
    });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  describe('Phase 4C: FULL upfront payment', () => {
    const fullModeShop = (overrides: Record<string, unknown> = {}) => ({
      ...baseShop,
      bookingPaymentMode: 'FULL' as const,
      stripeConnectAccountId: 'acct_full_mode',
      ...overrides,
    });

    it('4C-A: Starter + FULL + £30 → PENDING_PAYMENT, 3000p, 0% / 0p fee, account snapshot, no deposit field', async () => {
      findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, bookingPaymentMode: 'NONE' });

      const result = await createInstantBooking(bookingInput('full-free-30', 'FULL'), publicOptions);

      expect(result.depositRequired).toBe(true);
      expect(createdData()).toMatchObject({
        status: BookingStatus.PENDING_PAYMENT,
        paymentRequired: true,
        paymentStatus: PaymentStatus.UNPAID,
        depositAmountPence: null,
        bookingPaymentType: 'FULL',
        paymentAmountPence: 3000,
        kersivoPlatformFeeBps: 0,
        kersivoPlatformFeePence: 0,
        stripeConnectAccountIdAtPayment: 'acct_full_mode',
      });
      expect(enqueueEmail).not.toHaveBeenCalled();
    });

    it('4C-B: Full KERSIVO + FULL + £30 → 3000p, 0 bps, 0 fee', async () => {
      asState('FULL_KERSIVO');
      findUniqueOrThrowShop.mockResolvedValue(fullModeShop());

      await createInstantBooking(bookingInput('full-full-30'), publicOptions);

      expect(createdData()).toMatchObject({
        bookingPaymentType: 'FULL',
        paymentAmountPence: 3000,
        kersivoPlatformFeeBps: 0,
        kersivoPlatformFeePence: 0,
        depositAmountPence: null,
      });
    });

    it('4C-C: Starter + FULL choice still rejects a service below £5', async () => {
      findUniqueOrThrowShop.mockResolvedValue(fullModeShop());
      findUniqueOrThrowService.mockResolvedValue({ ...baseService, pricePence: 300 });

      await expect(
        createInstantBooking(bookingInput('full-free-3', 'FULL'), publicOptions),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'STARTER_SERVICE_PRICE_TOO_LOW',
      });
      expect(bookingCreate).not.toHaveBeenCalled();
    });

    it('4C-D: Full KERSIVO + FULL mode + £0 service → BOOKED, no Stripe', async () => {
      asState('FULL_KERSIVO');
      findUniqueOrThrowShop.mockResolvedValue(fullModeShop());
      findUniqueOrThrowService.mockResolvedValue({ ...baseService, pricePence: 0 });

      const result = await createInstantBooking(bookingInput('full-zero'), publicOptions);

      expect(result.depositRequired).toBe(false);
      expect(createdData()).toMatchObject(NONE_SNAPSHOT);
    });

    it('4C-E: FULL with Connect missing / not ready fails closed — never pay-at-shop, no booking', async () => {
      for (const shop of [
        fullModeShop({ stripeConnectAccountId: null }),
        fullModeShop({ stripeConnectChargesEnabled: false }),
      ]) {
        findUniqueOrThrowShop.mockResolvedValue(shop);
        const error = await createInstantBooking(bookingInput('full-no-connect'), publicOptions).catch((e) => e);
        expect(error).toBeInstanceOf(BookingActionError);
        expect(error).toMatchObject({ statusCode: 503, code: 'BOOKING_PAYMENT_NOT_READY' });
      }
      expect(transaction).not.toHaveBeenCalled();
      expect(bookingCreate).not.toHaveBeenCalled();
    });
  });

  it('Starter £0 public service is rejected rather than falling back to no payment', async () => {
    findUniqueOrThrowService.mockResolvedValue({ ...baseService, pricePence: 0 });

    await expect(createInstantBooking(bookingInput('free-zero'), publicOptions)).rejects.toMatchObject({
      statusCode: 422,
      code: 'STARTER_SERVICE_PRICE_TOO_LOW',
    });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('owner sandbox / non-public bookings never collect, even in FULL mode', async () => {
    findUniqueOrThrowShop.mockResolvedValue({ ...baseShop, bookingPaymentMode: 'FULL' });

    const result = await createInstantBooking(bookingInput('admin'), { requiredShopId: 'shop_1' });

    expect(result.depositRequired).toBe(false);
    expect(createdData()).toMatchObject(NONE_SNAPSHOT);
    expect(loadKersivoAccess).not.toHaveBeenCalled();
  });
});
