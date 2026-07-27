import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  shopSettingsFindUnique,
  barberCount,
  serviceCount,
  shopOpeningHoursCount,
  barberFindFirst,
} = vi.hoisted(() => ({
  shopSettingsFindUnique: vi.fn(),
  barberCount: vi.fn(),
  serviceCount: vi.fn(),
  shopOpeningHoursCount: vi.fn(),
  barberFindFirst: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...a: unknown[]) => shopSettingsFindUnique(...a),
    },
    barber: {
      count: (...a: unknown[]) => barberCount(...a),
      findFirst: (...a: unknown[]) => barberFindFirst(...a),
    },
    service: {
      count: (...a: unknown[]) => serviceCount(...a),
    },
    shopOpeningHours: {
      count: (...a: unknown[]) => shopOpeningHoursCount(...a),
    },
  },
}));

import { shopMeetsOnboardingCompletionRequirements } from './onboarding';

describe('shopMeetsOnboardingCompletionRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopSettingsFindUnique.mockResolvedValue({ name: 'Fade House' });
    barberCount.mockResolvedValue(1);
    serviceCount.mockResolvedValue(1);
    shopOpeningHoursCount.mockResolvedValue(5);
    barberFindFirst.mockResolvedValue({
      id: 'b1',
      rules: [{ dayOfWeek: 1, startMinutes: 540, endMinutes: 1080 }],
    });
  });

  it('requires at least one active shop opening day', async () => {
    shopOpeningHoursCount.mockResolvedValue(0);
    expect(await shopMeetsOnboardingCompletionRequirements('shop-1')).toBe(false);
  });

  it('passes when shop hours and other requirements are met', async () => {
    expect(await shopMeetsOnboardingCompletionRequirements('shop-1')).toBe(true);
  });
});
