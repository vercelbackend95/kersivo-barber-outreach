import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { DEFAULT_ONBOARDING_HOURS } from '@/lib/admin/shopOpeningHours';

const {
  requireOnboardingAccess,
  advanceOnboardingStep,
  loadOnboardingState,
  replaceShopOpeningHours,
} = vi.hoisted(() => ({
  requireOnboardingAccess: vi.fn(),
  advanceOnboardingStep: vi.fn(),
  loadOnboardingState: vi.fn(),
  replaceShopOpeningHours: vi.fn(),
}));

vi.mock('@/lib/admin/onboarding', () => ({
  requireOnboardingAccess,
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_BARBERS: 3,
  timeStringToMinutes: (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  },
}));

vi.mock('@/lib/admin/shopOpeningHours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/shopOpeningHours')>();
  return {
    ...actual,
    replaceShopOpeningHours,
  };
});

import { PUT } from './shop-hours';

function makeJsonCtx(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/onboarding/shop-hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('PUT /api/admin/onboarding/shop-hours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOnboardingAccess.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-1',
      via: 'session',
    });
    loadOnboardingState.mockResolvedValue({
      shopHours: DEFAULT_ONBOARDING_HOURS,
      onboardingCurrentStep: 3,
    });
  });

  it('saves active ranges and advances to barbers', async () => {
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) => ({ ...row }));
    const res = await PUT(makeJsonCtx({ rules }));
    expect(res.status).toBe(200);
    expect(replaceShopOpeningHours).toHaveBeenCalledWith('shop-1', rules);
    expect(advanceOnboardingStep).toHaveBeenCalledWith('shop-1', 3);
    expect(loadOnboardingState).toHaveBeenCalled();
  });

  it('rejects when no active days', async () => {
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) => ({ ...row, active: false }));
    const res = await PUT(makeJsonCtx({ rules }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one day/i);
    expect(replaceShopOpeningHours).not.toHaveBeenCalled();
  });

  it('rejects invalid active ranges', async () => {
    const rules = DEFAULT_ONBOARDING_HOURS.map((row) =>
      row.dayOfWeek === 1 ? { ...row, startTime: '18:00', endTime: '09:00' } : { ...row },
    );
    const res = await PUT(makeJsonCtx({ rules }));
    expect(res.status).toBe(400);
    expect(replaceShopOpeningHours).not.toHaveBeenCalled();
  });
});
