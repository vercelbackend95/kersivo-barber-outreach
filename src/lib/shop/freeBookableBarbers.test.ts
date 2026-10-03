import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadKersivoAccess } = vi.hoisted(() => ({ loadKersivoAccess: vi.fn() }));

vi.mock('../db/client', () => ({ prisma: {} }));
vi.mock('./kersivoAccess', () => ({
  loadKersivoAccess: (...a: unknown[]) => loadKersivoAccess(...a),
}));

import {
  FREE_BOOKABLE_BARBER_LIMIT,
  checkFreeBookableBarberActivation,
  checkFreeBookableBarberTotal,
  countActiveBookableBarbers,
  exceedsFreeBookableBarberLimit,
  freeBookableBarberLimitApplies,
  isFreeActivationBarberCountEligible,
  isFreeBookableBarberLimitError,
} from './freeBookableBarbers';

function dbWithActiveCount(count: number) {
  const barberCount = vi.fn().mockResolvedValue(count);
  return { db: { barber: { count: barberCount } } as never, barberCount };
}

describe('Free bookable barber limit helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING', capabilities: [] });
  });

  it('limit is 4 active bookable barbers', () => {
    expect(FREE_BOOKABLE_BARBER_LIMIT).toBe(4);
    expect(exceedsFreeBookableBarberLimit(4)).toBe(false);
    expect(exceedsFreeBookableBarberLimit(5)).toBe(true);
    expect(isFreeActivationBarberCountEligible(4)).toBe(true);
    expect(isFreeActivationBarberCountEligible(5)).toBe(false);
  });

  it('applies to FREE_BOOKING always, SETUP only on the onboarding path, never to FULL', () => {
    expect(freeBookableBarberLimitApplies('FREE_BOOKING')).toBe(true);
    expect(freeBookableBarberLimitApplies('SETUP')).toBe(false);
    expect(freeBookableBarberLimitApplies('SETUP', { includeSetup: true })).toBe(true);
    expect(freeBookableBarberLimitApplies('FULL_KERSIVO', { includeSetup: true })).toBe(false);
  });

  it('counts only active (bookable) barbers', async () => {
    const { db, barberCount } = dbWithActiveCount(3);
    expect(await countActiveBookableBarbers('shop-1', db)).toBe(3);
    expect(barberCount).toHaveBeenCalledWith({ where: { shopId: 'shop-1', active: true } });
  });

  it('activation check excludes the barber being activated from the current count', async () => {
    const { db, barberCount } = dbWithActiveCount(3);
    expect(await checkFreeBookableBarberActivation(db, { shopId: 'shop-1', barberId: 'b4' })).toBeNull();
    expect(barberCount).toHaveBeenCalledWith({
      where: { shopId: 'shop-1', active: true, id: { not: 'b4' } },
    });
  });

  it('H: blocks the 5th bookable barber for a Free shop', async () => {
    const { db } = dbWithActiveCount(4);
    const result = await checkFreeBookableBarberActivation(db, { shopId: 'shop-1' });
    expect(isFreeBookableBarberLimitError(result)).toBe(true);
    expect(result).toMatchObject({ status: 409, code: 'FREE_BOOKABLE_BARBER_LIMIT', limit: 4 });
  });

  it('J: never blocks Full shops', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: [] });
    expect(
      await checkFreeBookableBarberTotal({ shopId: 'shop-1', resultingActiveCount: 12, includeSetup: true }),
    ).toBeNull();
  });

  it('does not resolve product state while under the limit', async () => {
    expect(await checkFreeBookableBarberTotal({ shopId: 'shop-1', resultingActiveCount: 4 })).toBeNull();
    expect(loadKersivoAccess).not.toHaveBeenCalled();
  });

  it('SETUP is limited only when the caller opts in', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'SETUP', capabilities: [] });
    expect(await checkFreeBookableBarberTotal({ shopId: 'shop-1', resultingActiveCount: 5 })).toBeNull();
    expect(
      await checkFreeBookableBarberTotal({ shopId: 'shop-1', resultingActiveCount: 5, includeSetup: true }),
    ).toMatchObject({ code: 'FREE_BOOKABLE_BARBER_LIMIT' });
  });
});
