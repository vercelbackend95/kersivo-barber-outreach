import { describe, expect, it, vi, beforeEach } from 'vitest';

const serviceFindMany = vi.fn();
const barberCreate = vi.fn();
const barberAggregate = vi.fn();
const barberServiceCreateMany = vi.fn();
const availabilityRuleCreateMany = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: { findMany: (...a: unknown[]) => serviceFindMany(...a) },
    barber: {
      create: (...a: unknown[]) => barberCreate(...a),
      aggregate: (...a: unknown[]) => barberAggregate(...a),
    },
    barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
    availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

vi.mock('@/lib/db/serializableTransaction', () => ({
  runSerializableTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      service: { findMany: (...a: unknown[]) => serviceFindMany(...a) },
      barber: {
        create: (...a: unknown[]) => barberCreate(...a),
        aggregate: (...a: unknown[]) => barberAggregate(...a),
        findFirst: vi.fn(),
      },
      barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
      availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
      shopMember: { findFirst: vi.fn().mockResolvedValue(null) },
      shopInvite: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'inv-1',
          email: 'a@b.com',
          role: 'BARBER',
          barberId: null,
          displayName: 'Alex',
          bookable: false,
          expiresAt: new Date(),
        }),
      },
    }),
}));

vi.mock('@/lib/admin/rbac/members', () => ({
  inviteExpiresAt: () => new Date('2026-08-01T00:00:00.000Z'),
}));

import {
  assertValidShopServices,
  assertValidWorkingHours,
  createStandaloneBookingProfile,
  normalizeServiceIds,
} from './teamCreation';

describe('normalizeServiceIds', () => {
  it('dedupes and drops empties', () => {
    expect(normalizeServiceIds(['a', ' a ', '', 'a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('assertValidWorkingHours', () => {
  it('accepts a valid active day', () => {
    const result = assertValidWorkingHours([
      { dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: true },
    ]);
    expect(result.ok).toBe(true);
  });

  it('rejects invalid dayOfWeek', () => {
    const result = assertValidWorkingHours([
      { dayOfWeek: 9, startMinutes: 540, endMinutes: 1080, active: true },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_WORKING_HOURS');
  });

  it('rejects invalid time range', () => {
    const result = assertValidWorkingHours([
      { dayOfWeek: 1, startMinutes: 1080, endMinutes: 540, active: true },
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid break range', () => {
    const result = assertValidWorkingHours([
      {
        dayOfWeek: 1,
        startMinutes: 540,
        endMinutes: 1080,
        breakStartMin: 800,
        breakEndMin: 700,
        active: true,
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects break outside working window', () => {
    const result = assertValidWorkingHours([
      {
        dayOfWeek: 1,
        startMinutes: 540,
        endMinutes: 1080,
        breakStartMin: 500,
        breakEndMin: 560,
        active: true,
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate active day rows', () => {
    const result = assertValidWorkingHours([
      { dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: true },
      { dayOfWeek: 1, startMinutes: 600, endMinutes: 900, active: true },
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects when no active day', () => {
    const result = assertValidWorkingHours([
      { dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: false },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe('assertValidShopServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when any service id is missing', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    const result = await assertValidShopServices({
      shopId: 'shop-1',
      serviceIds: ['svc-1', 'svc-missing'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_SERVICE_SELECTION');
  });

  it('accepts when all services are active for the shop', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }, { id: 'svc-2' }]);
    const result = await assertValidShopServices({
      shopId: 'shop-1',
      serviceIds: ['svc-1', 'svc-2'],
    });
    expect(result.ok).toBe(true);
  });
});

describe('createStandaloneBookingProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        barber: {
          create: (...a: unknown[]) => barberCreate(...a),
          aggregate: (...a: unknown[]) => barberAggregate(...a),
        },
        barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
        availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
      }),
    );
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b1',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: null,
      userId: null,
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });
  });

  it('creates Barber, services, and hours inside one transaction', async () => {
    await createStandaloneBookingProfile({
      shopId: 'shop-1',
      name: 'Alex',
      serviceIds: ['svc-1'],
      hours: [
        {
          dayOfWeek: 1,
          startMinutes: 540,
          endMinutes: 1080,
          breakStartMin: null,
          breakEndMin: null,
          active: true,
        },
      ],
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(barberCreate).toHaveBeenCalledTimes(1);
    expect(barberServiceCreateMany).toHaveBeenCalledTimes(1);
    expect(availabilityRuleCreateMany).toHaveBeenCalledTimes(1);
  });

  it('rolls back when service write fails', async () => {
    barberServiceCreateMany.mockRejectedValue(new Error('service write failed'));
    await expect(
      createStandaloneBookingProfile({
        shopId: 'shop-1',
        name: 'Alex',
        serviceIds: ['svc-1'],
        hours: [
          {
            dayOfWeek: 1,
            startMinutes: 540,
            endMinutes: 1080,
            breakStartMin: null,
            breakEndMin: null,
            active: true,
          },
        ],
      }),
    ).rejects.toThrow('service write failed');
  });

  it('rolls back when working-hours write fails', async () => {
    availabilityRuleCreateMany.mockRejectedValue(new Error('hours write failed'));
    await expect(
      createStandaloneBookingProfile({
        shopId: 'shop-1',
        name: 'Alex',
        serviceIds: ['svc-1'],
        hours: [
          {
            dayOfWeek: 1,
            startMinutes: 540,
            endMinutes: 1080,
            breakStartMin: null,
            breakEndMin: null,
            active: true,
          },
        ],
      }),
    ).rejects.toThrow('hours write failed');
  });
});
