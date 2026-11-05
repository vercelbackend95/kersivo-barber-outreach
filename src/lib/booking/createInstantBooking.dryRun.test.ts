/**
 * Shop health H1.4: createInstantBooking({ dryRun: true }) side-effect audit.
 *
 * $transaction is simulated over an in-memory store with real commit / rollback semantics: writes go to a
 * staged copy that is committed only when the callback resolves. So "counts unchanged" here means the
 * dry run's writes were really discarded by the rollback, not just mocked away.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

type Row = Record<string, unknown> & { id: string };
type Store = { booking: Row[]; client: Row[]; emailOutbound: Row[]; idempotencyLookups: string[] };

const state = vi.hoisted(() => ({
  store: { booking: [], client: [], emailOutbound: [], idempotencyLookups: [] } as unknown as {
    booking: Array<Record<string, unknown> & { id: string }>;
    client: Array<Record<string, unknown> & { id: string }>;
    emailOutbound: Array<Record<string, unknown> & { id: string }>;
    idempotencyLookups: string[];
  },
  seq: 0,
}));

const stripeCalls = vi.hoisted(() => vi.fn());
const tryDeliverOutboxEmail = vi.hoisted(() => vi.fn());
const enqueueEmail = vi.hoisted(() => vi.fn());
const lockShopAndCheckNewBookingCapability = vi.hoisted(() => vi.fn());
const loadKersivoAccess = vi.hoisted(() => vi.fn());

const SERVICE = { id: 'svc_1', shopId: 'shop_1', name: 'Skin fade', pricePence: 2500, durationMinutes: 30, bufferMinutes: 0, isActive: true };
const SHOP = {
  id: 'shop_1',
  name: 'Test Shop',
  shopPaidAt: new Date(),
  smsRemindersEnabled: false,
  depositsEnabled: false,
  bookingPaymentMode: 'NONE',
  stripeConnectAccountId: null,
  stripeConnectAccountType: null,
  stripeConnectChargesEnabled: false,
  stripeConnectDisconnectedAt: null,
  pendingConfirmationMins: 15,
  defaultBufferMinutes: 0,
  timezone: 'Europe/London',
};

function overlaps(row: Record<string, unknown>, where: { barberId: string; NOT: Array<Record<string, { lte?: Date; gte?: Date }>> }) {
  if (row.barberId !== where.barberId) return false;
  if (row.status !== BookingStatus.BOOKED && row.status !== BookingStatus.PENDING_PAYMENT) return false;
  const start = where.NOT[0].endAt!.lte!;
  const end = where.NOT[1].startAt!.gte!;
  return (row.endAt as Date) > start && (row.startAt as Date) < end;
}

function txClient(staged: Store) {
  return {
    booking: {
      findFirst: vi.fn(async ({ where }: { where: never }) => staged.booking.find((row) => overlaps(row, where)) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const row = {
          id: `book_${++state.seq}`,
          serviceId: data.service.connect.id,
          barberId: data.barber.connect.id,
          clientId: data.client.connect.id,
          ...Object.fromEntries(Object.entries(data).filter(([k]) => !['service', 'barber', 'client'].includes(k))),
        };
        staged.booking.push(row);
        return { ...row, service: { name: SERVICE.name }, barber: { id: row.barberId, name: 'Alex' } };
      }),
    },
    barberTimeOff: { findFirst: vi.fn(async () => null) },
    client: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        const existing = staged.client.find((c) => c.email === create.email && c.shopId === create.shopId);
        if (existing) return existing;
        const row = { id: `client_${++state.seq}`, ...create };
        staged.client.push(row);
        return row;
      }),
    },
  };
}

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => {
        state.store.idempotencyLookups.push(where.idempotencyKey);
        return null;
      }),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    service: { findUniqueOrThrow: vi.fn(async () => SERVICE) },
    shopSettings: { findUniqueOrThrow: vi.fn(async () => SHOP), findUnique: vi.fn(async () => ({ name: SHOP.name })) },
    barber: {
      findUnique: vi.fn(async () => ({ id: 'barber_1', shopId: 'shop_1', name: 'Alex', active: true })),
      findMany: vi.fn(async () => []),
    },
    barberService: { findUnique: vi.fn(async () => ({ serviceId: 'svc_1' })) },
    availabilityRule: {
      findMany: vi.fn(async () => [{ id: 'r', barberId: 'barber_1', dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: true }]),
    },
    barberTimeOff: { findMany: vi.fn(async () => []) },
    shopOpeningHours: { findMany: vi.fn(async () => []) },
    // Real transaction semantics over the in-memory store: commit on resolve, discard on throw.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const staged: Store = {
        booking: [...state.store.booking],
        client: [...state.store.client],
        emailOutbound: [...state.store.emailOutbound],
        idempotencyLookups: state.store.idempotencyLookups,
      };
      const result = await fn({ ...txClient(staged), __staged: staged });
      state.store.booking = staged.booking;
      state.store.client = staged.client;
      state.store.emailOutbound = staged.emailOutbound;
      return result;
    }),
  },
}));

vi.mock('../db/resilience', () => ({ PUBLIC_BOOKING_UNAVAILABLE_MESSAGE: 'unavailable', isPrismaQuotaExceededError: () => false }));
vi.mock('../db/timeBlocks', () => ({
  getTimeBlockDelegate: () => ({ findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) }),
}));
vi.mock('../email/sender', () => ({
  buildInstantBookingConfirmationEmail: () => ({ subject: 'Confirmed', html: '<p>ok</p>' }),
  buildRescheduledBookingEmail: vi.fn(),
  sendShopCancelledBookingEmail: vi.fn(),
}));
vi.mock('../email/outbox', () => ({
  enqueueEmail: (tx: { __staged: Store }, data: Record<string, unknown>) => {
    enqueueEmail(data);
    const row = { id: `out_${++state.seq}`, ...data };
    tx.__staged.emailOutbound.push(row);
    return row;
  },
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));
vi.mock('../sms/reminders', () => ({ smsReminderClearData: {} }));
vi.mock('../email/reminders', () => ({ emailReminderClearData: {} }));
vi.mock('@/lib/admin/shopOpeningHours', () => ({ intersectMinutesWithShopDay: (x: unknown) => x }));
vi.mock('@/lib/admin/shopPublicActivity', () => ({ getShopPublicActivityPauseOnDate: async () => ({ paused: false, reason: null }) }));
vi.mock('./slots', () => ({ generateSlots: () => ['10:00', '10:30', '11:00'] }));
vi.mock('./bookingCreationGate', () => ({
  BOOKING_PRODUCT_STATE_CHANGED: 'BOOKING_PRODUCT_STATE_CHANGED',
  SHOP_NOT_ACCEPTING_NEW_BOOKINGS: 'SHOP_NOT_ACCEPTING_NEW_BOOKINGS',
  lockShopAndCheckNewBookingCapability: (...args: unknown[]) => lockShopAndCheckNewBookingCapability(...args),
}));
vi.mock('../shop/kersivoAccess', () => ({ loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args) }));
// Every Stripe-reaching path from booking/service.ts goes through depositMoney (refunds) or the stripe SDK.
vi.mock('./depositMoney', () => ({
  depositRefundClientMessage: () => '',
  bookingPaymentRefundClientMessage: () => '',
  forfeitBookingDeposit: (...args: unknown[]) => stripeCalls('forfeit', ...args),
  requestBookingPaymentRefund: (...args: unknown[]) => stripeCalls('refund', ...args),
  attemptBookingPaymentRefund: (...args: unknown[]) => stripeCalls('attemptRefund', ...args),
}));
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => new Proxy({}, { get: () => (...args: unknown[]) => stripeCalls('sdk', ...args) })),
}));

import { createInstantBooking } from './service';

const INPUT = {
  serviceId: 'svc_1',
  barberId: 'barber_1',
  date: '2026-11-09',
  time: '10:00',
  fullName: 'KERSIVO health check',
  email: 'health-check@kersivo.co.uk',
};

function counts() {
  return { bookings: state.store.booking.length, clients: state.store.client.length, emails: state.store.emailOutbound.length };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.store.booking = [];
  state.store.client = [];
  state.store.emailOutbound = [];
  state.store.idempotencyLookups = [];
  lockShopAndCheckNewBookingCapability.mockResolvedValue({ ok: true, state: 'FULL_KERSIVO' });
  loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: ['PUBLIC_BOOKING'] });
});

describe('createInstantBooking dryRun (side-effect audit)', () => {
  it('runs the create path, then rolls back: Booking, Client and EmailOutbound counts unchanged', async () => {
    const before = counts();
    const result = await createInstantBooking(
      { ...INPUT, idempotencyKey: 'health-check-key' },
      { dryRun: true, requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING', allowDepositCollection: true },
    );

    expect(result).toEqual({
      dryRun: true,
      wouldCreate: expect.objectContaining({
        shopId: 'shop_1',
        serviceId: 'svc_1',
        serviceName: 'Skin fade',
        barberId: 'barber_1',
        barberName: 'Alex',
        status: BookingStatus.BOOKED,
        paymentRequired: false,
        totalPricePence: 2500,
      }),
    });
    expect(counts()).toEqual(before);
    // The shop lock / capability gate ran inside the (rolled-back) transaction.
    expect(lockShopAndCheckNewBookingCapability).toHaveBeenCalledTimes(1);
  });

  it('enqueues and delivers no email, ignores the idempotency key, and never calls Stripe', async () => {
    await createInstantBooking({ ...INPUT, idempotencyKey: 'health-check-key' }, { dryRun: true, requiredShopId: 'shop_1' });
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
    expect(state.store.idempotencyLookups).toEqual([]);
    expect(stripeCalls).not.toHaveBeenCalled();
  });

  it('enqueues no email even without skipConfirmationEmail (email is skipped before it is built)', async () => {
    await createInstantBooking(INPUT, { dryRun: true });
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(state.store.emailOutbound).toHaveLength(0);
  });

  it('a real booking for the same slot afterwards succeeds (the dry run left no hold)', async () => {
    await createInstantBooking(INPUT, { dryRun: true, requiredShopId: 'shop_1' });
    const real = await createInstantBooking({ ...INPUT, fullName: 'Real Customer', email: 'real@example.com' }, { requiredShopId: 'shop_1' });
    expect(real.replayed).toBe(false);
    expect(real.status).toBe(BookingStatus.BOOKED);
    expect(counts()).toEqual({ bookings: 1, clients: 1, emails: 1 });
    expect(tryDeliverOutboxEmail).toHaveBeenCalledTimes(1);
  });

  it('a dry run for a slot that is already taken fails like a real booking would', async () => {
    await createInstantBooking({ ...INPUT, email: 'real@example.com' }, { requiredShopId: 'shop_1' });
    await expect(createInstantBooking(INPUT, { dryRun: true, requiredShopId: 'shop_1' })).rejects.toThrow();
    expect(counts()).toEqual({ bookings: 1, clients: 1, emails: 1 });
  });

  it('surfaces a refused capability gate instead of a pass', async () => {
    lockShopAndCheckNewBookingCapability.mockResolvedValueOnce({ ok: false, departed: false });
    await expect(
      createInstantBooking(INPUT, { dryRun: true, requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING' }),
    ).rejects.toThrow('New bookings are not available for this shop.');
    expect(counts()).toEqual({ bookings: 0, clients: 0, emails: 0 });
  });
});
