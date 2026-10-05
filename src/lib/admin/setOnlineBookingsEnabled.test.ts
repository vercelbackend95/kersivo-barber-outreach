import { beforeEach, describe, expect, it, vi } from 'vitest';

const barberFindFirst = vi.fn();
const barberUpdate = vi.fn();
const barberCreate = vi.fn();
const barberServiceFindMany = vi.fn();
const availabilityRuleFindMany = vi.fn();
const shopMemberUpdate = vi.fn();
const barberCount = vi.fn();
const queryRaw = vi.fn();
const loadKersivoAccess = vi.fn();

const tx = {
  $queryRaw: (...a: unknown[]) => queryRaw(...a),
  barber: {
    count: (...a: unknown[]) => barberCount(...a),
    update: (...a: unknown[]) => barberUpdate(...a),
  },
};

vi.mock('@/lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...a: unknown[]) => loadKersivoAccess(...a),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    barber: {
      findFirst: (...a: unknown[]) => barberFindFirst(...a),
      update: (...a: unknown[]) => barberUpdate(...a),
      create: (...a: unknown[]) => barberCreate(...a),
    },
    barberService: {
      findMany: (...a: unknown[]) => barberServiceFindMany(...a),
    },
    availabilityRule: {
      findMany: (...a: unknown[]) => availabilityRuleFindMany(...a),
    },
    shopMember: {
      update: (...a: unknown[]) => shopMemberUpdate(...a),
    },
  },
}));

import {
  isValidWorkingHoursRule,
  setOnlineBookingsEnabled,
} from './setOnlineBookingsEnabled';

describe('isValidWorkingHoursRule', () => {
  it('accepts an active weekday with start before end', () => {
    expect(
      isValidWorkingHoursRule({
        dayOfWeek: 1,
        startMinutes: 540,
        endMinutes: 1080,
        active: true,
      }),
    ).toBe(true);
  });

  it('rejects inactive or invalid windows', () => {
    expect(
      isValidWorkingHoursRule({
        dayOfWeek: 1,
        startMinutes: 540,
        endMinutes: 1080,
        active: false,
      }),
    ).toBe(false);
    expect(
      isValidWorkingHoursRule({
        dayOfWeek: 0,
        startMinutes: 540,
        endMinutes: 1080,
        active: true,
      }),
    ).toBe(false);
    expect(
      isValidWorkingHoursRule({
        dayOfWeek: 8,
        startMinutes: 540,
        endMinutes: 1080,
        active: true,
      }),
    ).toBe(false);
    expect(
      isValidWorkingHoursRule({
        dayOfWeek: 1,
        startMinutes: 1080,
        endMinutes: 540,
        active: true,
      }),
    ).toBe(false);
  });
});

describe('setOnlineBookingsEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    barberCount.mockResolvedValue(0);
    queryRaw.mockResolvedValue([]);
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING', capabilities: [] });
    barberFindFirst.mockResolvedValue({ id: 'b1', active: true });
    barberUpdate.mockResolvedValue({ id: 'b1', active: false });
    barberServiceFindMany.mockResolvedValue([{ serviceId: 'svc-1' }]);
    availabilityRuleFindMany.mockResolvedValue([
      { dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: true },
    ]);
  });

  it('disabling sets only Barber.active = false and never touches userId or ShopMember', async () => {
    const result = await setOnlineBookingsEnabled({
      shopId: 'shop-1',
      barberId: 'b1',
      enabled: false,
    });

    expect(result).toEqual({ ok: true, active: false });
    expect(barberUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { active: false },
    });
    expect(barberUpdate.mock.calls[0][0].data.userId).toBeUndefined();
    expect(shopMemberUpdate).not.toHaveBeenCalled();
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('enabling does not inspect teamStatus and only updates active', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b1', active: false });
    barberUpdate.mockResolvedValue({ id: 'b1', active: true });

    const result = await setOnlineBookingsEnabled({
      shopId: 'shop-1',
      barberId: 'b1',
      enabled: true,
    });

    expect(result).toEqual({ ok: true, active: true });
    expect(barberUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { active: true },
    });
    expect(JSON.stringify(barberUpdate.mock.calls)).not.toMatch(/teamStatus/);
  });

  it('Free shop with 4 bookable barbers cannot enable a 5th', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b5', active: false });
    barberCount.mockResolvedValue(4);

    const result = await setOnlineBookingsEnabled({
      shopId: 'shop-1',
      barberId: 'b5',
      enabled: true,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'FREE_BOOKABLE_BARBER_LIMIT',
      error: 'KERSIVO Starter includes up to 4 barbers taking online bookings.',
    });
    expect(queryRaw).toHaveBeenCalled();
    expect(barberCount).toHaveBeenCalledWith({
      where: { shopId: 'shop-1', active: true, id: { not: 'b5' } },
    });
    expect(barberUpdate).not.toHaveBeenCalled();
  });

  it('Free shop with 3 bookable barbers may enable a 4th without resolving product state', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b4', active: false });
    barberCount.mockResolvedValue(3);

    const result = await setOnlineBookingsEnabled({ shopId: 'shop-1', barberId: 'b4', enabled: true });

    expect(result).toEqual({ ok: true, active: true });
    expect(loadKersivoAccess).not.toHaveBeenCalled();
    expect(barberUpdate).toHaveBeenCalledWith({ where: { id: 'b4' }, data: { active: true } });
  });

  it('Full shop is not subject to the Free four-barber limit', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: [] });
    barberFindFirst.mockResolvedValue({ id: 'b9', active: false });
    barberCount.mockResolvedValue(8);

    const result = await setOnlineBookingsEnabled({ shopId: 'shop-1', barberId: 'b9', enabled: true });

    expect(result).toEqual({ ok: true, active: true });
    expect(barberUpdate).toHaveBeenCalledWith({ where: { id: 'b9' }, data: { active: true } });
  });

  it('disabling a barber in an over-limit Free shop is always allowed', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b1', active: true });
    barberCount.mockResolvedValue(6);

    const result = await setOnlineBookingsEnabled({ shopId: 'shop-1', barberId: 'b1', enabled: false });

    expect(result).toEqual({ ok: true, active: false });
    expect(barberCount).not.toHaveBeenCalled();
  });

  it('returns 422 when services are missing', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b1', active: false });
    barberServiceFindMany.mockResolvedValue([]);

    const result = await setOnlineBookingsEnabled({
      shopId: 'shop-1',
      barberId: 'b1',
      enabled: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.code).toBe('ONLINE_BOOKING_SETUP_INCOMPLETE');
    expect(result.missing).toContain('services');
    expect(result.error).toMatch(/service/i);
    expect(barberUpdate).not.toHaveBeenCalled();
  });

  it('returns 422 when working hours are missing', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b1', active: false });
    availabilityRuleFindMany.mockResolvedValue([
      { dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: false },
    ]);

    const result = await setOnlineBookingsEnabled({
      shopId: 'shop-1',
      barberId: 'b1',
      enabled: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.missing).toEqual(['workingHours']);
    expect(result.error).toMatch(/working hours/i);
    expect(barberUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when Barber is not in shop', async () => {
    barberFindFirst.mockResolvedValue(null);
    const result = await setOnlineBookingsEnabled({
      shopId: 'shop-1',
      barberId: 'missing',
      enabled: true,
    });
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(barberUpdate).not.toHaveBeenCalled();
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('never creates a Barber profile', async () => {
    await setOnlineBookingsEnabled({ shopId: 'shop-1', barberId: 'b1', enabled: false });
    expect(barberCreate).not.toHaveBeenCalled();
  });
});
