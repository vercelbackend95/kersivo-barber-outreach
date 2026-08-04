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
const findFirstDeposit = vi.fn();
const findFirstSaas = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/pricing/offerMode', () => ({
  ENABLE_SETUP_FEES: false,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
    setupDeposit: {
      findFirst: (...args: unknown[]) => findFirstDeposit(...args),
    },
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirstSaas(...args),
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

describe('resolveNavbarPreviewCta (setup fees off)', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    findUnique.mockReset();
    findFirstDeposit.mockReset();
    findFirstSaas.mockReset();
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
  });

  it('returns continue_setup for incomplete onboarding', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'owner@example.com',
      role: 'OWNER',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: false });
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta.state).toBe('continue_setup');
  });

  it('returns Open Admin when role lacks billing.manage', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'barber@example.com',
      role: 'BARBER',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: true });
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta).toEqual({
      state: 'open_admin',
      label: 'Open Admin',
      href: '/admin',
    });
    expect(findFirstSaas).not.toHaveBeenCalled();
  });

  it.each(['ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const)(
    'returns Open Admin for %s subscription',
    async (status) => {
      resolveAdminAccess.mockResolvedValue({
        via: 'session',
        shopId: 'shop-1',
        userEmail: 'owner@example.com',
        role: 'OWNER',
      });
      findUnique.mockResolvedValue({ onboardingCompleted: true });
      findFirstSaas.mockResolvedValue({ status });
      const cta = await resolveNavbarPreviewCta({} as never);
      expect(cta).toEqual({
        state: 'open_admin',
        label: 'Open Admin',
        href: '/admin',
      });
    },
  );

  it('returns Continue Purchase for PENDING', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'owner@example.com',
      role: 'OWNER',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: true });
    findFirstSaas.mockResolvedValue({ status: 'PENDING' });
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta).toEqual({
      state: 'continue_purchase',
      label: 'Continue Purchase',
      href: '/admin/launch?step=2',
    });
  });

  it('returns Launch My Barbershop for CANCELED', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'owner@example.com',
      role: 'OWNER',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: true });
    findFirstSaas.mockResolvedValue({ status: 'CANCELED' });
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta.state).toBe('launch_barbershop');
  });

  it('returns Launch My Barbershop when no subscription', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userEmail: 'owner@example.com',
      role: 'OWNER',
    });
    findUnique.mockResolvedValue({ onboardingCompleted: true });
    findFirstSaas.mockResolvedValue(null);
    const cta = await resolveNavbarPreviewCta({} as never);
    expect(cta.state).toBe('launch_barbershop');
  });
});

// Keep a note that deposit path still exists when ENABLE_SETUP_FEES is true (covered by dedicated flag module).
describe('setup deposit status constant still available', () => {
  it('exposes PENDING for legacy path', () => {
    expect(SetupDepositStatus.PENDING).toBe('PENDING');
  });
});
