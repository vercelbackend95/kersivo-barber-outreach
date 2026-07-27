import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { DEFAULT_ONBOARDING_HOURS } from '@/lib/admin/shopOpeningHours';

const {
  requireOnboardingAccess,
  advanceOnboardingStep,
  loadOnboardingState,
  markOnboardingCompleted,
  replaceBarberAvailabilityRules,
  serializeShopOpeningHours,
  loadShopOpeningHoursDays,
  barberFindMany,
} = vi.hoisted(() => ({
  requireOnboardingAccess: vi.fn(),
  advanceOnboardingStep: vi.fn(),
  loadOnboardingState: vi.fn(),
  markOnboardingCompleted: vi.fn(),
  replaceBarberAvailabilityRules: vi.fn(),
  serializeShopOpeningHours: vi.fn(),
  loadShopOpeningHoursDays: vi.fn(),
  barberFindMany: vi.fn(),
}));

vi.mock('@/lib/admin/onboarding', () => ({
  requireOnboardingAccess,
  advanceOnboardingStep,
  loadOnboardingState,
  markOnboardingCompleted,
  replaceBarberAvailabilityRules,
  ONBOARDING_STEP_REVIEW: 6,
  timeStringToMinutes: (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  },
}));

vi.mock('@/lib/admin/shopOpeningHours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/shopOpeningHours')>();
  return {
    ...actual,
    serializeShopOpeningHours,
    loadShopOpeningHoursDays,
  };
});

vi.mock('@/lib/db/client', () => ({
  prisma: {
    barber: {
      findMany: (...a: unknown[]) => barberFindMany(...a),
    },
  },
}));

import { PUT } from './hours';

function makeJsonCtx(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/onboarding/hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('PUT /api/admin/onboarding/hours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOnboardingAccess.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-1',
      via: 'session',
    });
    loadOnboardingState.mockResolvedValue({ onboardingCurrentStep: 6 });
    loadShopOpeningHoursDays.mockResolvedValue([
      { dayOfWeek: 1, active: true, startMinutes: 9 * 60, endMinutes: 18 * 60 },
    ]);
    serializeShopOpeningHours.mockResolvedValue(
      DEFAULT_ONBOARDING_HOURS.map((row) =>
        row.dayOfWeek === 1
          ? { ...row, active: true, startTime: '09:00', endTime: '18:00' }
          : { ...row, active: false },
      ),
    );
    barberFindMany.mockResolvedValue([{ id: 'barber-1' }]);
  });

  it('rejects barber hours outside shop hours', async () => {
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) =>
      row.dayOfWeek === 1
        ? { ...row, active: true, startTime: '08:00', endTime: '18:00' }
        : { ...row, active: false },
    );
    const res = await PUT(makeJsonCtx({ rules, applyToAllBarbers: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/within shop opening hours/i);
    expect(replaceBarberAvailabilityRules).not.toHaveBeenCalled();
  });

  it('saves when barber hours sit inside shop hours', async () => {
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) =>
      row.dayOfWeek === 1
        ? { ...row, active: true, startTime: '10:00', endTime: '17:00' }
        : { ...row, active: false },
    );
    const res = await PUT(makeJsonCtx({ rules, applyToAllBarbers: true }));
    expect(res.status).toBe(200);
    expect(replaceBarberAvailabilityRules).toHaveBeenCalledWith('barber-1', rules);
    expect(advanceOnboardingStep).toHaveBeenCalledWith('shop-1', 6);
  });

  it('apply-all writes hours to inactive Owner/Manager seats as well as bookable ones', async () => {
    barberFindMany.mockResolvedValue([{ id: 'owner-inactive' }, { id: 'barber-active' }]);
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) =>
      row.dayOfWeek === 1
        ? { ...row, active: true, startTime: '10:00', endTime: '17:00' }
        : { ...row, active: false },
    );
    const res = await PUT(makeJsonCtx({ rules, applyToAllBarbers: true }));
    expect(res.status).toBe(200);
    expect(barberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop-1' },
      }),
    );
    expect(replaceBarberAvailabilityRules).toHaveBeenCalledTimes(2);
    expect(replaceBarberAvailabilityRules).toHaveBeenCalledWith('owner-inactive', rules);
    expect(replaceBarberAvailabilityRules).toHaveBeenCalledWith('barber-active', rules);
  });

  it('apply-all off writes only the first seat (Owner), even when inactive', async () => {
    barberFindMany.mockResolvedValue([{ id: 'owner-inactive' }, { id: 'barber-active' }]);
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) =>
      row.dayOfWeek === 1
        ? { ...row, active: true, startTime: '10:00', endTime: '17:00' }
        : { ...row, active: false },
    );
    const res = await PUT(makeJsonCtx({ rules, applyToAllBarbers: false }));
    expect(res.status).toBe(200);
    expect(replaceBarberAvailabilityRules).toHaveBeenCalledTimes(1);
    expect(replaceBarberAvailabilityRules).toHaveBeenCalledWith('owner-inactive', rules);
  });

  it('rejects when shop opening hours are not configured', async () => {
    loadShopOpeningHoursDays.mockResolvedValue([]);
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) => ({ ...row }));
    const res = await PUT(makeJsonCtx({ rules, applyToAllBarbers: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/shop opening hours/i);
  });
});
