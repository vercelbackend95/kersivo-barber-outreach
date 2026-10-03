import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  resolveAdminAccess,
  loadKersivoAccess,
  linkAllServicesToAllBarbers,
  shopFindUnique,
  shopFindUniqueOrThrow,
  prismaTransaction,
  txQueryRaw,
  txShopUpdate,
  txBarberFindMany,
  txBarberCreate,
  txBarberUpdate,
  txBarberUpdateMany,
} = vi.hoisted(() => ({
  resolveAdminAccess: vi.fn(),
  loadKersivoAccess: vi.fn(),
  linkAllServicesToAllBarbers: vi.fn(),
  shopFindUnique: vi.fn(),
  shopFindUniqueOrThrow: vi.fn(),
  prismaTransaction: vi.fn(),
  txQueryRaw: vi.fn(),
  txShopUpdate: vi.fn(),
  txBarberFindMany: vi.fn(),
  txBarberCreate: vi.fn(),
  txBarberUpdate: vi.fn(),
  txBarberUpdateMany: vi.fn(),
}));

vi.mock('../../../lib/admin/auth', () => ({ resolveAdminAccess }));
vi.mock('../../../lib/admin/rbac/can', () => ({ requirePermission: () => null }));
vi.mock('../../../lib/admin/onboarding', () => ({ linkAllServicesToAllBarbers }));
vi.mock('../../../lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...a: unknown[]) => loadKersivoAccess(...a),
}));
vi.mock('../../../lib/db/client', () => ({
  // No global barber client: the roster must be read through the locked transaction.
  prisma: {
    shopSettings: {
      findUnique: (...a: unknown[]) => shopFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => shopFindUniqueOrThrow(...a),
    },
    $transaction: (...a: unknown[]) => prismaTransaction(...a),
  },
}));

import { PUT } from './launch-workspace';

function ctx(barbers: Array<{ id?: string; name: string }>): APIContext {
  return {
    request: new Request('http://localhost/api/setup/launch-workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName: 'Fade Room', townCity: 'Leeds', barbers }),
    }),
  } as unknown as APIContext;
}

const named = (...names: string[]) => names.map((name) => ({ name }));

describe('PUT /api/setup/launch-workspace — Free bookable barber limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userName: 'Owner',
      userEmail: 'owner@example.com',
    });
    shopFindUnique.mockResolvedValue({ onboardingCompleted: true });
    shopFindUniqueOrThrow.mockResolvedValue({ name: 'Fade Room', townCity: 'Leeds', barbers: [] });
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING', capabilities: [] });
    linkAllServicesToAllBarbers.mockResolvedValue(undefined);
    txQueryRaw.mockResolvedValue([{ id: 'shop-1' }]);
    txShopUpdate.mockResolvedValue({});
    txBarberFindMany.mockResolvedValue([]);
    txBarberCreate.mockImplementation(async ({ data }: { data: { name: string } }) => ({
      id: `b-${data.name}`,
    }));
    txBarberUpdate.mockResolvedValue({});
    txBarberUpdateMany.mockResolvedValue({ count: 0 });
    prismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        __tx: true,
        $queryRaw: (...a: unknown[]) => txQueryRaw(...a),
        shopSettings: { update: (...a: unknown[]) => txShopUpdate(...a) },
        barber: {
          findMany: (...a: unknown[]) => txBarberFindMany(...a),
          create: (...a: unknown[]) => txBarberCreate(...a),
          update: (...a: unknown[]) => txBarberUpdate(...a),
          updateMany: (...a: unknown[]) => txBarberUpdateMany(...a),
        },
      }),
    );
  });

  it('FREE_BOOKING: fast pre-check rejects a 5th active barber before the transaction', async () => {
    const res = await PUT(ctx(named('A', 'B', 'C', 'D', 'E')));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      code: 'FREE_BOOKABLE_BARBER_LIMIT',
      error: 'KERSIVO Free includes up to 4 barbers taking online bookings.',
      limit: 4,
    });
    expect(prismaTransaction).not.toHaveBeenCalled();
  });

  it('FREE_BOOKING: re-checks under the shop lock when pre-lock state was stale', async () => {
    loadKersivoAccess
      .mockResolvedValueOnce({ state: 'SETUP', capabilities: [] })
      .mockResolvedValueOnce({ state: 'FREE_BOOKING', capabilities: [] });
    const res = await PUT(ctx(named('A', 'B', 'C', 'D', 'E')));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'FREE_BOOKABLE_BARBER_LIMIT' });
    expect(txQueryRaw).toHaveBeenCalledTimes(1);
    expect(loadKersivoAccess.mock.calls[1]![2]).toMatchObject({ __tx: true });
    expect(loadKersivoAccess.mock.invocationCallOrder[1]!).toBeGreaterThan(
      txQueryRaw.mock.invocationCallOrder[0]!,
    );
    expect(txShopUpdate).not.toHaveBeenCalled();
    expect(txBarberCreate).not.toHaveBeenCalled();
    expect(txBarberUpdate).not.toHaveBeenCalled();
    expect(txBarberUpdateMany).not.toHaveBeenCalled();
    expect(linkAllServicesToAllBarbers).not.toHaveBeenCalled();
  });

  it('FREE_BOOKING: four active barbers are allowed', async () => {
    const res = await PUT(ctx(named('A', 'B', 'C', 'D')));
    expect(res.status).toBe(200);
    expect(txBarberCreate).toHaveBeenCalledTimes(4);
  });

  it('SETUP stays unrestricted on this path', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'SETUP', capabilities: [] });
    const res = await PUT(ctx(named('A', 'B', 'C', 'D', 'E', 'F')));
    expect(res.status).toBe(200);
    expect(txBarberCreate).toHaveBeenCalledTimes(6);
  });

  it('FULL_KERSIVO is unlimited', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: [] });
    const res = await PUT(ctx(named('A', 'B', 'C', 'D', 'E', 'F')));
    expect(res.status).toBe(200);
    expect(txBarberCreate).toHaveBeenCalledTimes(6);
  });

  it('takes the shop lock and reads the roster through the transaction before writing', async () => {
    txBarberFindMany.mockResolvedValue([{ id: 'b-keep' }, { id: 'b-drop' }]);
    const res = await PUT(ctx([{ id: 'b-keep', name: 'Keep' }, { name: 'New' }]));
    expect(res.status).toBe(200);

    const lockOrder = txQueryRaw.mock.invocationCallOrder[0]!;
    expect(txBarberFindMany.mock.invocationCallOrder[0]!).toBeGreaterThan(lockOrder);
    expect(txShopUpdate.mock.invocationCallOrder[0]!).toBeGreaterThan(lockOrder);
    expect(txBarberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'b-keep' } }),
    );
    expect(txBarberCreate).toHaveBeenCalledTimes(1);
    expect(txBarberUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b-drop'] }, shopId: 'shop-1' },
      data: { active: false },
    });
    expect(linkAllServicesToAllBarbers).toHaveBeenCalledWith('shop-1');
  });
});
