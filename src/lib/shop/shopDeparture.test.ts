import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEmail = vi.fn();
const recordAccountLifecycleEvent = vi.fn();

vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
}));
vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: { SHOP_DEPARTURE_REQUESTED: 'SHOP_DEPARTURE_REQUESTED' },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { resolveShopPurgeEligibility } from '@/lib/setup/shopPurgeEligibility';
import {
  hasKersivoCapability,
  resolveKersivoAccess,
  resolveKersivoProductState,
} from './kersivoAccess';
import {
  advanceWindingDownDepartures,
  countFutureOperationalBookings,
  loadShopDepartureView,
  materializeDepartureForEndedFull,
  materializePostFullDepartures,
  requestStarterDeparture,
} from './shopDeparture';

const NOW = new Date('2026-10-05T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

type Booking = { status: string; startAt: Date; endAt: Date };
type World = {
  shop: Record<string, unknown> | null;
  departure: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
  openSubscriptions?: number;
  bookings: Booking[];
  candidates?: Record<string, unknown>[];
};

const starterShop = {
  id: 'shop-1',
  name: 'Fade Room',
  shopPaidAt: null,
  smsRemindersEnabled: false,
  freeBookingActivatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

const futureBooking: Booking = {
  status: 'BOOKED',
  startAt: new Date(NOW.getTime() + 2 * DAY),
  endAt: new Date(NOW.getTime() + 2 * DAY + 30 * 60 * 1000),
};

function makeDb(world: World) {
  const db = {
    $queryRaw: vi.fn(async () => []),
    shopSettings: {
      findUnique: vi.fn(async () =>
        world.shop
          ? {
              ...world.shop,
              departure: world.departure
                ? { status: world.departure.status, retentionEndsAt: world.departure.retentionEndsAt ?? null }
                : null,
            }
          : null,
      ),
    },
    shopDeparture: {
      findUnique: vi.fn(async () => world.departure),
      findMany: vi.fn(async () => (world.departure ? [world.departure] : [])),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (world.departure) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '5.22.0',
          });
        }
        world.departure = { ...data };
        return world.departure;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
          if (world.departure && world.departure.status === where.status) {
            Object.assign(world.departure, data);
            return { count: 1 };
          }
          return { count: 0 };
        },
      ),
    },
    saasSubscription: {
      findFirst: vi.fn(async () => world.subscription),
      findUnique: vi.fn(async () =>
        world.subscription ? { id: 'saas-1', shopId: 'shop-1', ...world.subscription } : null,
      ),
      count: vi.fn(async () => world.openSubscriptions ?? 0),
      findMany: vi.fn(async () => world.candidates ?? []),
    },
    booking: {
      findMany: vi.fn(async () => world.bookings),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db));
  return db;
}

function expectBookingsUntouched(db: ReturnType<typeof makeDb>) {
  expect(db.booking.update).not.toHaveBeenCalled();
  expect(db.booking.updateMany).not.toHaveBeenCalled();
  expect(db.booking.delete).not.toHaveBeenCalled();
  expect(db.booking.deleteMany).not.toHaveBeenCalled();
}

describe('product resolver with a shop departure', () => {
  it('a stale freeBookingActivatedAt never reactivates a departed shop', () => {
    expect(
      resolveKersivoProductState({ ...starterShop, departure: { status: 'RETENTION' } }, null, NOW),
    ).toBe('SETUP');
  });

  it('a STARTER post-Full choice never reactivates a departed shop', () => {
    expect(
      resolveKersivoProductState(
        { ...starterShop, departure: { status: 'WINDING_DOWN' } },
        { status: 'CANCELED', currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'), postFullPlan: 'STARTER' },
        NOW,
      ),
    ).toBe('SETUP');
  });

  it('wind-down keeps existing-appointment handling but no public booking, payments, manual bookings or Google setup', () => {
    const access = resolveKersivoAccess({ ...starterShop, departure: { status: 'WINDING_DOWN' } }, null, NOW);
    expect(access.state).toBe('SETUP');
    expect(access.departure).toBe('WINDING_DOWN');
    for (const blocked of ['PUBLIC_BOOKING', 'BOOKING_PAYMENTS', 'MANUAL_BOOKINGS', 'GOOGLE_BOOKING_SETUP'] as const) {
      expect(hasKersivoCapability(access, blocked)).toBe(false);
    }
    expect(hasKersivoCapability(access, 'AUTOMATED_EMAIL_REMINDERS')).toBe(true);
    expect(hasKersivoCapability(access, 'BOOKING_CORE')).toBe(true);
  });

  it('retention has no capabilities', () => {
    const access = resolveKersivoAccess({ ...starterShop, departure: { status: 'RETENTION' } }, null, NOW);
    expect(access).toEqual({ state: 'SETUP', capabilities: [], departure: 'RETENTION' });
  });

  it('shops without a departure resolve exactly as before', () => {
    expect(resolveKersivoAccess(starterShop, null, NOW)).toEqual(
      expect.not.objectContaining({ departure: expect.anything() }),
    );
    expect(resolveKersivoProductState(starterShop, null, NOW)).toBe('FREE_BOOKING');
  });
});

describe('countFutureOperationalBookings', () => {
  it('counts upcoming / in-flight bookings only, scoped through barber or service', async () => {
    const db = makeDb({
      shop: starterShop,
      departure: null,
      subscription: null,
      bookings: [
        futureBooking,
        { status: 'PENDING_PAYMENT', startAt: futureBooking.startAt, endAt: futureBooking.endAt },
        { status: 'BOOKED', startAt: new Date(NOW.getTime() - 2 * DAY), endAt: new Date(NOW.getTime() - 2 * DAY + 1800000) },
      ],
    });
    expect(await countFutureOperationalBookings('shop-1', NOW, db as never)).toBe(2);
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ barber: { shopId: 'shop-1' } }, { service: { shopId: 'shop-1' } }],
        }),
      }),
    );
  });
});

describe('requestStarterDeparture', () => {
  beforeEach(() => {
    enqueueEmail.mockReset();
    enqueueEmail.mockResolvedValue({ id: 'outbox-1' });
    recordAccountLifecycleEvent.mockReset();
  });

  const params = { shopId: 'shop-1', userId: 'user-1', email: 'Owner@Example.com' };

  it('Starter with no future bookings → inactive retention with the canonical 30-day window', async () => {
    const world: World = { shop: starterShop, departure: null, subscription: null, bookings: [] };
    const db = makeDb(world);
    const result = await requestStarterDeparture(params, { db: db as never, now: NOW });

    expect(result).toMatchObject({ ok: true, created: true, outboxId: 'outbox-1' });
    expect(world.departure).toMatchObject({
      shopId: 'shop-1',
      status: 'RETENTION',
      origin: 'DIRECT_STARTER_LEAVE',
      requestedAt: NOW,
      requestedByUserId: 'user-1',
      requestedByEmail: 'owner@example.com',
      serviceEndedAt: NOW,
      retentionStartedAt: NOW,
      retentionEndsAt: new Date(NOW.getTime() + 30 * DAY),
    });
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail.mock.calls[0][1]).toMatchObject({
      shopId: 'shop-1',
      purpose: 'SHOP_DEPARTURE_CONFIRMATION',
      subject: 'Your KERSIVO departure request',
      dedupeKey: 'shop-departure:shop-1',
    });
  });

  it('Starter with future bookings → wind-down; bookings are never cancelled or deleted', async () => {
    const world: World = { shop: starterShop, departure: null, subscription: null, bookings: [futureBooking] };
    const db = makeDb(world);
    const result = await requestStarterDeparture(params, { db: db as never, now: NOW });

    expect(result).toMatchObject({
      ok: true,
      created: true,
      departure: { status: 'WINDING_DOWN', futureAppointments: 1 },
    });
    expect(world.departure).toMatchObject({ status: 'WINDING_DOWN', windDownStartedAt: NOW, retentionEndsAt: null });
    expectBookingsUntouched(db);
    const html = String(enqueueEmail.mock.calls[0][1].html);
    expect(html).toContain('1 future appointment');
    expect(html).toContain('Google Business Profile');
    expect(html).not.toMatch(/will be deleted on|deleted on \d/i);
  });

  it('is idempotent: a repeat request creates no second row or email', async () => {
    const world: World = { shop: starterShop, departure: null, subscription: null, bookings: [] };
    const db = makeDb(world);
    await requestStarterDeparture(params, { db: db as never, now: NOW });
    const again = await requestStarterDeparture(params, { db: db as never, now: NOW });

    expect(again).toMatchObject({ ok: true, created: false, outboxId: null });
    expect(db.shopDeparture.create).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it('a concurrent duplicate (unique violation) resolves to the winning row without a second email', async () => {
    const world: World = { shop: starterShop, departure: null, subscription: null, bookings: [] };
    const db = makeDb(world);
    db.shopDeparture.findUnique
      .mockResolvedValueOnce(null)
      .mockImplementation(async () => world.departure);
    world.departure = null;
    db.shopDeparture.create.mockImplementationOnce(async () => {
      world.departure = { status: 'RETENTION', origin: 'DIRECT_STARTER_LEAVE', requestedAt: NOW };
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      });
    });
    const result = await requestStarterDeparture(params, { db: db as never, now: NOW });
    expect(result).toMatchObject({ ok: true, created: false });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('Full KERSIVO owners cannot use the direct Starter leave', async () => {
    const world: World = {
      shop: { ...starterShop, shopPaidAt: new Date('2026-09-01T00:00:00.000Z') },
      departure: null,
      subscription: { status: 'ACTIVE', currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY), postFullPlan: 'UNDECIDED' },
      bookings: [],
    };
    const db = makeDb(world);
    expect(await requestStarterDeparture(params, { db: db as never, now: NOW })).toEqual({
      ok: false,
      code: 'FULL_KERSIVO_ACTIVE',
    });
    expect(db.shopDeparture.create).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('a never-activated SETUP shop has nothing to leave', async () => {
    const world: World = {
      shop: { ...starterShop, freeBookingActivatedAt: null },
      departure: null,
      subscription: null,
      bookings: [],
    };
    const db = makeDb(world);
    expect(await requestStarterDeparture(params, { db: db as never, now: NOW })).toEqual({
      ok: false,
      code: 'NOT_ACTIVE_STARTER',
    });
  });

  it('demo shops are refused before any database access', async () => {
    const db = makeDb({ shop: starterShop, departure: null, subscription: null, bookings: [] });
    expect(
      await requestStarterDeparture({ ...params, shopId: DEMO_SHOP_ID }, { db: db as never, now: NOW }),
    ).toEqual({ ok: false, code: 'PROTECTED_SHOP' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('departure lifecycle cron steps', () => {
  it('wind-down stays while future bookings remain, then moves to retention', async () => {
    const world: World = {
      shop: starterShop,
      departure: { shopId: 'shop-1', status: 'WINDING_DOWN', origin: 'DIRECT_STARTER_LEAVE', requestedAt: NOW },
      subscription: null,
      bookings: [futureBooking],
    };
    const db = makeDb(world);
    expect(await advanceWindingDownDepartures(NOW, db as never)).toEqual({ advanced: 0 });
    expect(world.departure?.status).toBe('WINDING_DOWN');

    world.bookings = [];
    expect(await advanceWindingDownDepartures(NOW, db as never)).toEqual({ advanced: 1 });
    expect(world.departure).toMatchObject({
      status: 'RETENTION',
      retentionStartedAt: NOW,
      retentionEndsAt: new Date(NOW.getTime() + 30 * DAY),
    });
    expectBookingsUntouched(db);
  });

  const FULL_END = new Date('2026-10-04T00:00:00.000Z');

  function endedFull(postFullPlan: string, overrides: Record<string, unknown> = {}) {
    return {
      id: 'saas-1',
      shopId: 'shop-1',
      status: 'CANCELED',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: FULL_END,
      canceledAt: FULL_END,
      // Billing retention still open: it must NOT delay the departure.
      retentionEndsAt: new Date(FULL_END.getTime() + 30 * DAY),
      customerEmail: 'owner@example.com',
      postFullPlan,
      ...overrides,
    };
  }

  function worldFor(subscription: Record<string, unknown>, extra: Partial<World> = {}): World {
    return {
      shop: { ...starterShop, freeBookingActivatedAt: null },
      departure: null,
      subscription,
      bookings: [],
      ...extra,
    };
  }

  it('1: ACTIVE Full with cancellation scheduled + LEAVE → no departure before the paid period ends', async () => {
    const world = worldFor(
      endedFull('LEAVE', { status: 'ACTIVE', currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY), canceledAt: null }),
      { shop: { ...starterShop, shopPaidAt: new Date('2026-09-01T00:00:00.000Z') }, openSubscriptions: 1 },
    );
    const db = makeDb(world);
    expect(await materializeDepartureForEndedFull('saas-1', NOW, db as never)).toBeNull();
    expect(world.departure).toBeNull();
  });

  it('2: ended Full + LEAVE → departure immediately, retention from the departure (not billing retention)', async () => {
    const world = worldFor(endedFull('LEAVE'));
    const db = makeDb(world);
    expect(await materializeDepartureForEndedFull('saas-1', NOW, db as never)).toMatchObject({
      shopId: 'shop-1',
      departure: { origin: 'FULL_POST_PERIOD_LEAVE', status: 'RETENTION' },
    });
    expect(world.departure).toMatchObject({
      origin: 'FULL_POST_PERIOD_LEAVE',
      saasSubscriptionId: 'saas-1',
      serviceEndedAt: FULL_END,
      retentionStartedAt: NOW,
      retentionEndsAt: new Date(NOW.getTime() + 30 * DAY),
    });
  });

  it('3 + 8: ended Full + CHOICE_REQUIRED → NO_POST_FULL_CHOICE departure while billing retention is still open', async () => {
    const world = worldFor(endedFull('CHOICE_REQUIRED'));
    const db = makeDb(world);
    expect(await materializeDepartureForEndedFull('saas-1', NOW, db as never)).not.toBeNull();
    expect(world.departure).toMatchObject({ origin: 'NO_POST_FULL_CHOICE' });
  });

  it('4: ended Full + legacy UNDECIDED → ordinary departure immediately', async () => {
    const world = worldFor(endedFull('UNDECIDED'));
    const db = makeDb(world);
    expect(await materializeDepartureForEndedFull('saas-1', NOW, db as never)).not.toBeNull();
    expect(world.departure).toMatchObject({ origin: 'NO_POST_FULL_CHOICE' });
  });

  it('5: ended Full + explicit STARTER → never a departure (Starter wins under the shop lock)', async () => {
    const world = worldFor(endedFull('STARTER'), { shop: starterShop });
    const db = makeDb(world);
    expect(await materializeDepartureForEndedFull('saas-1', NOW, db as never)).toBeNull();
    expect(world.departure).toBeNull();
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('6: CHOICE_REQUIRED with a future operational booking → WINDING_DOWN, no retention countdown', async () => {
    const world = worldFor(endedFull('CHOICE_REQUIRED'), { bookings: [futureBooking] });
    const db = makeDb(world);
    await materializeDepartureForEndedFull('saas-1', NOW, db as never);
    expect(world.departure).toMatchObject({ status: 'WINDING_DOWN', retentionEndsAt: null });
    expectBookingsUntouched(db);
    expect(
      resolveKersivoProductState({ ...starterShop, departure: { status: 'WINDING_DOWN' } }, world.subscription as never, NOW),
    ).toBe('SETUP');
  });

  it('7: CHOICE_REQUIRED without future bookings → departure retention path', async () => {
    const world = worldFor(endedFull('CHOICE_REQUIRED'));
    const db = makeDb(world);
    await materializeDepartureForEndedFull('saas-1', NOW, db as never);
    expect(world.departure).toMatchObject({
      status: 'RETENTION',
      retentionEndsAt: new Date(NOW.getTime() + 30 * DAY),
    });
  });

  it('a newer subscription or an existing departure is never overridden; replays create nothing', async () => {
    const world = worldFor(endedFull('LEAVE'));
    const db = makeDb(world);
    await materializeDepartureForEndedFull('saas-1', NOW, db as never);
    expect(await materializeDepartureForEndedFull('saas-1', NOW, db as never)).toBeNull();
    expect(db.shopDeparture.create).toHaveBeenCalledTimes(1);
  });

  it('cron backstop materializes ended Full rows without waiting for billing retention', async () => {
    const world = worldFor(endedFull('CHOICE_REQUIRED'), {
      candidates: [{ id: 'saas-1', shopId: 'shop-1' }],
    });
    const db = makeDb(world);
    expect(await materializePostFullDepartures(NOW, db as never)).toEqual({ created: 1 });
    const where = (db.saasSubscription.findMany.mock.calls as unknown as Array<[{ where: Record<string, unknown> }]>)[0][0].where;
    expect(where).toEqual({
      status: 'CANCELED',
      shopId: { not: null },
      postFullPlan: { in: ['LEAVE', 'CHOICE_REQUIRED', 'UNDECIDED'] },
    });
    expect(recordAccountLifecycleEvent).toHaveBeenCalledTimes(1);
  });
});

describe('purge eligibility (P0)', () => {
  const retentionOver = { status: 'RETENTION', retentionEndsAt: new Date(NOW.getTime() - DAY) };

  it('active Starter with an old expired canceled Full row is never purge-eligible', async () => {
    const db = makeDb({
      shop: starterShop,
      departure: null,
      subscription: { status: 'CANCELED', currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'), postFullPlan: 'STARTER' },
      bookings: [],
    });
    expect(await resolveShopPurgeEligibility({ shopId: 'shop-1', now: NOW, db: db as never })).toEqual({
      ok: false,
      reason: 'no_departure',
    });
  });

  it('wind-down, open retention or future bookings all fail closed', async () => {
    const winding = makeDb({ shop: starterShop, departure: { status: 'WINDING_DOWN' }, subscription: null, bookings: [] });
    expect(await resolveShopPurgeEligibility({ shopId: 'shop-1', now: NOW, db: winding as never })).toEqual({
      ok: false,
      reason: 'winding_down',
    });
    const open = makeDb({
      shop: starterShop,
      departure: { status: 'RETENTION', retentionEndsAt: new Date(NOW.getTime() + DAY) },
      subscription: null,
      bookings: [],
    });
    expect(await resolveShopPurgeEligibility({ shopId: 'shop-1', now: NOW, db: open as never })).toEqual({
      ok: false,
      reason: 'retention_open',
    });
    const booked = makeDb({ shop: starterShop, departure: retentionOver, subscription: null, bookings: [futureBooking] });
    expect(await resolveShopPurgeEligibility({ shopId: 'shop-1', now: NOW, db: booked as never })).toEqual({
      ok: false,
      reason: 'future_bookings',
    });
  });

  it('paid Full outranks a departure and blocks the purge', async () => {
    const db = makeDb({
      shop: { ...starterShop, shopPaidAt: new Date('2026-09-01T00:00:00.000Z') },
      departure: retentionOver,
      subscription: { status: 'ACTIVE', cancelAtPeriodEnd: true, currentPeriodEnd: new Date(NOW.getTime() + DAY) },
      bookings: [],
    });
    expect(await resolveShopPurgeEligibility({ shopId: 'shop-1', now: NOW, db: db as never })).toEqual({
      ok: false,
      reason: 'active_service',
    });
  });

  it('departed shop past retention with no bookings is eligible', async () => {
    const db = makeDb({ shop: starterShop, departure: retentionOver, subscription: null, bookings: [] });
    expect(await resolveShopPurgeEligibility({ shopId: 'shop-1', now: NOW, db: db as never })).toEqual({ ok: true });
  });
});

describe('loadShopDepartureView', () => {
  it('offers direct leave only to active Starter shops', async () => {
    const starter = makeDb({ shop: starterShop, departure: null, subscription: null, bookings: [] });
    expect(await loadShopDepartureView('shop-1', NOW, starter as never)).toEqual({
      departure: null,
      canLeaveDirectly: true,
      fullKersivoActive: false,
    });
    const full = makeDb({
      shop: { ...starterShop, shopPaidAt: new Date('2026-09-01T00:00:00.000Z') },
      departure: null,
      subscription: { status: 'ACTIVE', currentPeriodEnd: new Date(NOW.getTime() + DAY) },
      bookings: [],
    });
    expect(await loadShopDepartureView('shop-1', NOW, full as never)).toMatchObject({
      canLeaveDirectly: false,
      fullKersivoActive: true,
    });
  });

  it('shows the wind-down future appointment count', async () => {
    const db = makeDb({
      shop: starterShop,
      departure: { status: 'WINDING_DOWN', origin: 'DIRECT_STARTER_LEAVE', requestedAt: NOW },
      subscription: null,
      bookings: [futureBooking, futureBooking],
    });
    expect(await loadShopDepartureView('shop-1', NOW, db as never)).toMatchObject({
      departure: { status: 'WINDING_DOWN', futureAppointments: 2 },
      canLeaveDirectly: false,
    });
  });
});
