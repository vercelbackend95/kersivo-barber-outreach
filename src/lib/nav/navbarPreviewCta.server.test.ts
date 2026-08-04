import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupDepositStatus } from '@prisma/client';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  NAVBAR_SUBSCRIBE_CTA_LABEL,
  getNavbar17CtaHref,
  getNavbar17CtaLabel,
} from '@/lib/nav/navbar17Items';

const resolveAdminAccess = vi.fn();
const findUnique = vi.fn();
const findFirst = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
    setupDeposit: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

import { resolveNavbarPreviewCta } from '@/lib/nav/navbarPreviewCta.server';

describe('navbar17 CTA fallbacks', () => {
  it('uses dynamic subscribe label and /admin/launch for landing/shop/testShop', () => {
    expect(NAVBAR_SUBSCRIBE_CTA_LABEL).toBe(`Get started — £${SAAS_MONTHLY_GBP}/month`);

    for (const variant of ['landing', 'shop', 'testShop'] as const) {
      expect(getNavbar17CtaLabel(variant)).toBe(NAVBAR_SUBSCRIBE_CTA_LABEL);
      expect(getNavbar17CtaHref(variant)).toBe('/admin/launch');
    }
  });

  it('keeps default variant fallbacks unchanged', () => {
    expect(getNavbar17CtaLabel('default')).toBe('Get started');
    expect(getNavbar17CtaHref('default')).toBe('/#pricing');
  });
});

describe('resolveNavbarPreviewCta', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    findUnique.mockReset();
    findFirst.mockReset();
  });

  it('returns get_started for unauthenticated users', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta).toEqual({
      state: 'get_started',
      label: NAVBAR_SUBSCRIBE_CTA_LABEL,
      href: '/admin/launch',
      track: 'saas_subscribe_click',
    });
    expect(cta.href).not.toBe('/admin/onboarding');
    expect(cta.track).not.toBe('plan_my_setup_click');
  });

  it('returns get_started when access is not session-based', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'secret', shopId: 'shop-1' });
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta.state).toBe('get_started');
    expect(cta.href).toBe('/admin/launch');
    expect(cta.track).toBe('saas_subscribe_click');
  });

  it('returns continue_setup for incomplete onboarding', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'owner@example.com',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: false });
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta).toEqual({
      state: 'continue_setup',
      label: 'Continue My Setup',
      href: '/admin/onboarding',
      track: 'plan_my_setup_click',
    });
  });

  it('returns continue_purchase for pending deposit', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'owner@example.com',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: true });
    findFirst.mockResolvedValue({ id: 'dep-1' });
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta).toEqual({
      state: 'continue_purchase',
      label: 'Continue Purchase',
      href: '/admin/launch?step=2',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: SetupDepositStatus.PENDING,
        }),
      }),
    );
  });

  it('returns launch_barbershop when onboarding is done and no pending purchase', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'owner@example.com',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: true });
    findFirst.mockResolvedValue(null);
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta).toEqual({
      state: 'launch_barbershop',
      label: 'Launch My Barbershop',
      href: '/admin/launch',
    });
  });
});
