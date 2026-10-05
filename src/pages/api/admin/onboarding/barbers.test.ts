import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  requireOnboardingAccess,
  advanceOnboardingStep,
  loadOnboardingState,
  shopMemberFindFirst,
  shopMemberUpdate,
  barberFindMany,
  barberCreate,
  barberUpdate,
  barberUpdateMany,
  prismaTransaction,
  linkMemberToBarber,
  unlinkMemberBarber,
  loadKersivoAccess,
  txQueryRaw,
} = vi.hoisted(() => ({
  loadKersivoAccess: vi.fn(),
  txQueryRaw: vi.fn(),
  requireOnboardingAccess: vi.fn(),
  advanceOnboardingStep: vi.fn(),
  loadOnboardingState: vi.fn(),
  shopMemberFindFirst: vi.fn(),
  shopMemberUpdate: vi.fn(),
  barberFindMany: vi.fn(),
  barberCreate: vi.fn(),
  barberUpdate: vi.fn(),
  barberUpdateMany: vi.fn(),
  prismaTransaction: vi.fn(),
  linkMemberToBarber: vi.fn(),
  unlinkMemberBarber: vi.fn(),
}));

vi.mock('@/lib/admin/onboarding', () => ({
  requireOnboardingAccess,
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_SERVICES: 4,
}));

vi.mock('@/lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...a: unknown[]) => loadKersivoAccess(...a),
}));

vi.mock('@/lib/admin/onboardingOwnerSeat', () => ({
  linkMemberToBarber,
  unlinkMemberBarber,
}));

vi.mock('@/lib/storage/vercelBlob', () => ({
  getBlobReadWriteToken: () => null,
  makeBlobPath: () => 'path',
  uploadPublicImageToBlob: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findFirst: (...a: unknown[]) => shopMemberFindFirst(...a),
      update: (...a: unknown[]) => shopMemberUpdate(...a),
    },
    // No global findMany: the roster must be read through the locked transaction.
    barber: {
      create: (...a: unknown[]) => barberCreate(...a),
      update: (...a: unknown[]) => barberUpdate(...a),
      updateMany: (...a: unknown[]) => barberUpdateMany(...a),
    },
    $transaction: (...a: unknown[]) => prismaTransaction(...a),
  },
}));

import { PUT } from './barbers';

function makeJsonCtx(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/onboarding/barbers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('PUT /api/admin/onboarding/barbers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOnboardingAccess.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-o',
      via: 'session',
    });
    shopMemberFindFirst.mockResolvedValue({
      id: 'mem-owner',
      userId: 'user-o',
      barberId: null,
      user: { email: 'owner@example.com' },
    });
    barberFindMany.mockResolvedValue([]);
    barberCreate.mockImplementation(async ({ data }: { data: { name: string } }) => ({
      id: `b-${data.name}`,
    }));
    barberUpdate.mockResolvedValue({ id: 'b1' });
    barberUpdateMany.mockResolvedValue({ count: 0 });
    linkMemberToBarber.mockResolvedValue(undefined);
    unlinkMemberBarber.mockResolvedValue(undefined);
    loadKersivoAccess.mockResolvedValue({ state: 'SETUP', capabilities: [] });
    advanceOnboardingStep.mockResolvedValue(undefined);
    loadOnboardingState.mockResolvedValue({ ok: true });
    txQueryRaw.mockResolvedValue([{ id: 'shop-1' }]);
    prismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        __tx: true,
        $queryRaw: (...a: unknown[]) => txQueryRaw(...a),
        barber: {
          findMany: (...a: unknown[]) => barberFindMany(...a),
          create: (...a: unknown[]) => barberCreate(...a),
          update: (...a: unknown[]) => barberUpdate(...a),
          updateMany: (...a: unknown[]) => barberUpdateMany(...a),
        },
        shopMember: {
          update: (...a: unknown[]) => shopMemberUpdate(...a),
        },
      };
      return fn(tx);
    });
  });

  it('solo forces online bookings and dual-links OWNER', async () => {
    const res = await PUT(
      makeJsonCtx({
        barbers: [{ name: 'Bartosz', onlineBookings: false }],
      }),
    );
    expect(res.status).toBe(200);
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Bartosz',
          active: true,
          userId: 'user-o',
          email: 'owner@example.com',
        }),
      }),
    );
    expect(linkMemberToBarber).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        memberId: 'mem-owner',
        barberId: 'b-Bartosz',
        userId: 'user-o',
      }),
    );
  });

  it('team with owner online bookings on links OWNER to first seat', async () => {
    const res = await PUT(
      makeJsonCtx({
        barbers: [
          { name: 'Owner', onlineBookings: true },
          { name: 'Sam', onlineBookings: true },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(barberCreate).toHaveBeenCalledTimes(2);
    expect(linkMemberToBarber).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        memberId: 'mem-owner',
        barberId: 'b-Owner',
      }),
    );
    expect(barberCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Sam',
          active: true,
        }),
      }),
    );
    const secondCreate = barberCreate.mock.calls[1][0].data;
    expect(secondCreate.userId).toBeUndefined();
  });

  it('team with owner online bookings off still links OWNER to inactive seat', async () => {
    const res = await PUT(
      makeJsonCtx({
        barbers: [
          { name: 'Owner', onlineBookings: false },
          { name: 'Sam', onlineBookings: true },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(barberCreate).toHaveBeenCalledTimes(2);
    expect(barberCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Owner',
          active: false,
          sortOrder: 0,
          userId: 'user-o',
        }),
      }),
    );
    expect(barberCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Sam', active: true }),
      }),
    );
    expect(linkMemberToBarber).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        memberId: 'mem-owner',
        barberId: 'b-Owner',
        userId: 'user-o',
      }),
    );
  });

  it('respects onlineBookings false on extra seats via active:false', async () => {
    const res = await PUT(
      makeJsonCtx({
        barbers: [
          { name: 'Owner', onlineBookings: true },
          { name: 'OffSeat', onlineBookings: false },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(barberCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'OffSeat',
          active: false,
        }),
      }),
    );
  });

  it('persists intendedRole MANAGER on extra seats and defaults Barber', async () => {
    const res = await PUT(
      makeJsonCtx({
        barbers: [
          { name: 'Owner', onlineBookings: true },
          { name: 'Papi', onlineBookings: true, intendedRole: 'MANAGER' },
          { name: 'Sam', onlineBookings: true },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(barberCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Papi',
          intendedRole: 'MANAGER',
        }),
      }),
    );
    expect(barberCreate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Sam',
          intendedRole: 'BARBER',
        }),
      }),
    );
  });

  it('updates existing solo seat and links when id is provided', async () => {
    barberFindMany.mockResolvedValue([{ id: 'b-existing', userId: null }]);
    const res = await PUT(
      makeJsonCtx({
        barbers: [{ id: 'b-existing', name: 'Bartosz' }],
      }),
    );
    expect(res.status).toBe(200);
    expect(barberCreate).not.toHaveBeenCalled();
    expect(barberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b-existing' },
        data: expect.objectContaining({
          name: 'Bartosz',
          active: true,
          userId: 'user-o',
        }),
      }),
    );
    expect(linkMemberToBarber).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ barberId: 'b-existing' }),
    );
  });

  describe('Free bookable barber limit', () => {
    const card = (name: string, onlineBookings: boolean) => ({ name, onlineBookings });

    it('allows SETUP to exceed four before the owner chooses Starter or Full', async () => {
      const res = await PUT(
        makeJsonCtx({
          barbers: ['A', 'B', 'C', 'D', 'E'].map((name) => card(name, true)),
        }),
      );
      expect(res.status).toBe(200);
      expect(barberCreate).toHaveBeenCalledTimes(5);
    });

    it('rejects a 5th bookable barber for a live FREE_BOOKING shop', async () => {
      loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING', capabilities: [] });
      const res = await PUT(
        makeJsonCtx({ barbers: ['A', 'B', 'C', 'D', 'E'].map((name) => card(name, true)) }),
      );
      expect(res.status).toBe(409);
      expect(barberCreate).not.toHaveBeenCalled();
    });

    it('I: non-bookable team records do not count toward the four', async () => {
      const res = await PUT(
        makeJsonCtx({
          barbers: [
            card('Owner', false),
            card('A', true),
            card('B', true),
            card('C', true),
            card('D', true),
            card('Manager', false),
          ],
        }),
      );
      expect(res.status).toBe(200);
      expect(barberCreate).toHaveBeenCalledTimes(6);
      expect(loadKersivoAccess).not.toHaveBeenCalled();
    });

    it('re-checks under the shop lock: stale pre-lock FULL state cannot exceed the limit', async () => {
      // Pre-check sees FULL; by the time the lock is held the shop resolves to FREE_BOOKING.
      loadKersivoAccess
        .mockResolvedValueOnce({ state: 'FULL_KERSIVO', capabilities: [] })
        .mockResolvedValueOnce({ state: 'FREE_BOOKING', capabilities: [] });
      const res = await PUT(
        makeJsonCtx({ barbers: ['A', 'B', 'C', 'D', 'E'].map((name) => card(name, true)) }),
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: 'FREE_BOOKABLE_BARBER_LIMIT', limit: 4 });
      expect(prismaTransaction).toHaveBeenCalledTimes(1);
      expect(loadKersivoAccess).toHaveBeenCalledTimes(2);
      expect(loadKersivoAccess.mock.calls[1]![2]).toMatchObject({ __tx: true });
      expect(barberCreate).not.toHaveBeenCalled();
      expect(barberUpdate).not.toHaveBeenCalled();
      expect(barberUpdateMany).not.toHaveBeenCalled();
      expect(linkMemberToBarber).not.toHaveBeenCalled();
      expect(advanceOnboardingStep).not.toHaveBeenCalled();
    });

    it('acquires the shop lock before reading the roster and resolving product state', async () => {
      loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: [] });
      const res = await PUT(
        makeJsonCtx({ barbers: ['A', 'B', 'C', 'D', 'E'].map((name) => card(name, true)) }),
      );
      expect(res.status).toBe(200);
      const lockOrder = txQueryRaw.mock.invocationCallOrder[0]!;
      expect(barberFindMany.mock.invocationCallOrder[0]!).toBeGreaterThan(lockOrder);
      expect(loadKersivoAccess.mock.invocationCallOrder[1]!).toBeGreaterThan(lockOrder);
      expect(barberCreate.mock.invocationCallOrder[0]!).toBeGreaterThan(
        loadKersivoAccess.mock.invocationCallOrder[1]!,
      );
    });

    it('resolves the owner seat and deactivations from the roster read under the lock', async () => {
      shopMemberFindFirst.mockResolvedValue({
        id: 'mem-owner',
        userId: 'user-o',
        barberId: 'b-owner',
        user: { email: 'owner@example.com' },
      });
      barberFindMany.mockResolvedValue([
        { id: 'b-owner', userId: 'user-o', avatarUrl: null },
        { id: 'b-stale', userId: null, avatarUrl: null },
      ]);
      const res = await PUT(
        makeJsonCtx({ barbers: [card('Owner', true), card('Sam', true)] }),
      );
      expect(res.status).toBe(200);
      expect(barberFindMany).toHaveBeenCalledWith({
        where: { shopId: 'shop-1' },
        select: { id: true, userId: true, avatarUrl: true },
      });
      expect(barberUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b-owner' } }),
      );
      expect(barberCreate).toHaveBeenCalledTimes(1);
      expect(barberUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b-stale'] }, shopId: 'shop-1' },
        data: { active: false, userId: null },
      });
    });

    it('J: FULL_KERSIVO is not subject to the Free four-barber limit', async () => {
      loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: [] });
      const res = await PUT(
        makeJsonCtx({ barbers: ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => card(name, true)) }),
      );
      expect(res.status).toBe(200);
      expect(barberCreate).toHaveBeenCalledTimes(6);
    });
  });
});
