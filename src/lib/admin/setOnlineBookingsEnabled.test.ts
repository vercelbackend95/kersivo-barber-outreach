import { beforeEach, describe, expect, it, vi } from 'vitest';

const barberFindFirst = vi.fn();
const barberUpdate = vi.fn();
const barberCreate = vi.fn();
const barberServiceFindMany = vi.fn();
const availabilityRuleFindMany = vi.fn();
const shopMemberUpdate = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
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
        dayOfWeek: 7,
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
