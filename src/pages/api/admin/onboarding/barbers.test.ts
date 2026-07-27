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
} = vi.hoisted(() => ({
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
    barber: {
      findMany: (...a: unknown[]) => barberFindMany(...a),
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
    advanceOnboardingStep.mockResolvedValue(undefined);
    loadOnboardingState.mockResolvedValue({ ok: true });
    prismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        barber: {
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
});
