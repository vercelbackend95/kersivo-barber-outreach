import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopMemberFindMany = vi.fn();
const shopInviteFindMany = vi.fn();
const shopInviteFindFirst = vi.fn();
const shopMemberFindFirst = vi.fn();
const shopMemberUpdate = vi.fn();
const barberFindFirst = vi.fn();
const barberFindMany = vi.fn();
const barberCreate = vi.fn();
const barberUpdate = vi.fn();
const barberUpdateMany = vi.fn();
const barberAggregate = vi.fn();
const serviceCount = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findMany: (...args: unknown[]) => shopMemberFindMany(...args),
      findFirst: (...args: unknown[]) => shopMemberFindFirst(...args),
      update: (...args: unknown[]) => shopMemberUpdate(...args),
    },
    shopInvite: {
      findMany: (...args: unknown[]) => shopInviteFindMany(...args),
      findFirst: (...args: unknown[]) => shopInviteFindFirst(...args),
    },
    barber: {
      findFirst: (...args: unknown[]) => barberFindFirst(...args),
      findMany: (...args: unknown[]) => barberFindMany(...args),
      create: (...args: unknown[]) => barberCreate(...args),
      update: (...args: unknown[]) => barberUpdate(...args),
      updateMany: (...args: unknown[]) => barberUpdateMany(...args),
      aggregate: (...args: unknown[]) => barberAggregate(...args),
    },
    service: {
      count: (...args: unknown[]) => serviceCount(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

const ensureBarberHasAllServices = vi.fn();
const ensureBarberHasAvailabilityRules = vi.fn();

vi.mock('@/lib/admin/defaultAvailability', () => ({
  ensureBarberHasAllServices: (...args: unknown[]) => ensureBarberHasAllServices(...args),
  ensureBarberHasAvailabilityRules: (...args: unknown[]) => ensureBarberHasAvailabilityRules(...args),
}));

import {
  linkMemberToBarberSeat,
  resolveBarberSeatForInvite,
} from './members';

describe('resolveBarberSeatForInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when neither seat nor createSeat is provided', async () => {
    const result = await resolveBarberSeatForInvite({
      shopId: 'shop-1',
      email: 'a@b.com',
    });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it('creates a new roster seat with services and hours', async () => {
    serviceCount.mockResolvedValue(3);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 1 } });
    barberCreate.mockResolvedValue({ id: 'barber-new' });
    ensureBarberHasAllServices.mockResolvedValue(undefined);
    ensureBarberHasAvailabilityRules.mockResolvedValue(undefined);

    const result = await resolveBarberSeatForInvite({
      shopId: 'shop-1',
      email: 'alex@shop.com',
      createSeat: { name: 'Alex' },
    });

    expect(result).toBe('barber-new');
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: 'shop-1',
          name: 'Alex',
          email: 'alex@shop.com',
          active: true,
          sortOrder: 2,
        }),
      }),
    );
    expect(ensureBarberHasAllServices).toHaveBeenCalledWith('barber-new', 'shop-1');
    expect(ensureBarberHasAvailabilityRules).toHaveBeenCalledWith('barber-new');
  });

  it('rejects createSeat when the shop has no active services', async () => {
    serviceCount.mockResolvedValue(0);

    const result = await resolveBarberSeatForInvite({
      shopId: 'shop-1',
      email: 'alex@shop.com',
      createSeat: { name: 'Alex' },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('accepts an existing free seat', async () => {
    barberFindFirst.mockResolvedValue({ id: 'barber-1', userId: null });
    shopMemberFindFirst.mockResolvedValue(null);
    shopInviteFindFirst.mockResolvedValue(null);

    const result = await resolveBarberSeatForInvite({
      shopId: 'shop-1',
      email: 'alex@shop.com',
      barberId: 'barber-1',
    });

    expect(result).toBe('barber-1');
  });
});

describe('linkMemberToBarberSeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links an unlinked Barber member to a free seat', async () => {
    shopMemberFindFirst
      .mockResolvedValueOnce({
        id: 'member-1',
        role: 'BARBER',
        barberId: null,
        userId: 'user-1',
      })
      .mockResolvedValueOnce(null);
    barberFindFirst.mockResolvedValue({ id: 'barber-1', name: 'Alex', userId: null });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        barber: {
          updateMany: barberUpdateMany,
          update: barberUpdate,
        },
        shopMember: {
          update: shopMemberUpdate,
        },
      };
      barberUpdate.mockResolvedValue({ id: 'barber-1' });
      shopMemberUpdate.mockResolvedValue({
        id: 'member-1',
        role: 'BARBER',
        barberId: 'barber-1',
        barber: { id: 'barber-1', name: 'Alex' },
      });
      return fn(tx);
    });

    const result = await linkMemberToBarberSeat({
      shopId: 'shop-1',
      memberId: 'member-1',
      barberId: 'barber-1',
    });

    expect(result).toEqual({
      id: 'member-1',
      role: 'BARBER',
      barberId: 'barber-1',
      barber: { id: 'barber-1', name: 'Alex' },
    });
    expect(barberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'barber-1' },
        data: { userId: 'user-1' },
      }),
    );
  });
});
