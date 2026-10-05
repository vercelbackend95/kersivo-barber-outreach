import { beforeEach, describe, expect, it, vi } from 'vitest';

const { shopFindUnique, subscriptionFindFirst } = vi.hoisted(() => ({
  shopFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...a: unknown[]) => shopFindUnique(...a) },
    saasSubscription: { findFirst: (...a: unknown[]) => subscriptionFindFirst(...a) },
  },
}));

import type { AdminAccess } from './auth';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';
import {
  FULL_UPGRADE_PAGE_PATH,
  KERSIVO_UPGRADE_REQUIRED,
  fullUpgradePageRedirect,
  launchWizardPageRedirect,
  requireAdminProductCapability,
} from './productCapability';

const now = new Date('2026-10-04T12:00:00.000Z');

function sessionAccess(overrides: Partial<AdminAccess> = {}): AdminAccess {
  return {
    shopId: 'shop-1',
    userId: 'u1',
    userName: 'Owner',
    userEmail: 'owner@example.com',
    emailVerified: true,
    userImage: null,
    via: 'session',
    role: 'OWNER',
    memberId: 'm1',
    barberId: null,
    permissions: [],
    ...overrides,
  } as AdminAccess;
}

const shopRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'shop-1',
  shopPaidAt: null,
  smsRemindersEnabled: false,
  freeBookingActivatedAt: null,
  ...overrides,
});

const ACTIVE_SUBSCRIPTION = {
  status: 'ACTIVE',
  currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z'),
  pastDueSince: null,
  cancelAtPeriodEnd: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionFindFirst.mockResolvedValue(null);
});

describe('G: a lapsed paid shop resolving to SETUP stays denied', () => {
  beforeEach(() => {
    // Stale paid-era booleans, no Free marker, subscription cancelled and past its period end.
    shopFindUnique.mockResolvedValue(
      shopRow({ shopPaidAt: new Date('2026-01-01T00:00:00.000Z'), smsRemindersEnabled: true }),
    );
    subscriptionFindFirst.mockResolvedValue({
      status: 'CANCELED',
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      pastDueSince: null,
      cancelAtPeriodEnd: false,
    });
  });

  it('resolves to SETUP', async () => {
    expect((await loadKersivoAccess('shop-1', now)).state).toBe('SETUP');
  });

  it.each(['REPORTS', 'CLIENTS', 'RETAIL', 'ASSISTANT', 'FULL_BOOKING_HISTORY', 'MANUAL_BOOKINGS', 'BRANDED_SITE'] as const)(
    'denies %s with KERSIVO_UPGRADE_REQUIRED',
    async (capability) => {
      const grant = await requireAdminProductCapability(sessionAccess(), capability, now);
      expect(grant).toBeInstanceOf(Response);
      const res = grant as Response;
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: KERSIVO_UPGRADE_REQUIRED, requiredCapability: capability });
    },
  );

  it('leaves RBAC permissions untouched', async () => {
    const access = sessionAccess({ permissions: ['reports.view'] } as Partial<AdminAccess>);
    await requireAdminProductCapability(access, 'REPORTS', now);
    expect(access.permissions).toEqual(['reports.view']);
  });
});

describe('I / J: Free stays locked, Full stays allowed', () => {
  it('I: Free Booking is denied REPORTS', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ freeBookingActivatedAt: new Date('2026-09-01T00:00:00.000Z') }));
    expect(await requireAdminProductCapability(sessionAccess(), 'REPORTS', now)).toBeInstanceOf(Response);
  });

  it('J: an active Full subscription is allowed REPORTS', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    subscriptionFindFirst.mockResolvedValue(ACTIVE_SUBSCRIPTION);
    const grant = await requireAdminProductCapability(sessionAccess(), 'REPORTS', now);
    expect(grant).not.toBeInstanceOf(Response);
    expect((grant as { productAccess: { state: string } }).productAccess.state).toBe('FULL_KERSIVO');
  });
});

describe('/admin/launch page guard', () => {
  it('sends a Free tenant to the real purchase page instead of the branded-site wizard', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ freeBookingActivatedAt: new Date('2026-09-01T00:00:00.000Z') }));
    expect(await launchWizardPageRedirect(sessionAccess())).toBe(FULL_UPGRADE_PAGE_PATH);
  });

  it('AG: sends a non-entitled SETUP owner to the purchase page (buying never needs BRANDED_SITE)', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    expect(await launchWizardPageRedirect(sessionAccess())).toBe('/admin/upgrade');
  });

  it('keeps the wizard working for Full', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    subscriptionFindFirst.mockResolvedValue(ACTIVE_SUBSCRIPTION);
    expect(await launchWizardPageRedirect(sessionAccess())).toBeNull();
  });

  it('keeps billing RBAC: a Barber session is sent back to the dashboard without loading the plan', async () => {
    expect(await launchWizardPageRedirect(sessionAccess({ role: 'BARBER', barberId: 'b1' }))).toBe('/admin');
    expect(shopFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['anonymous "Start subscription" visitor', null],
    ['guest preview', sessionAccess({ via: 'preview', userId: null })],
    ['legacy secret access', sessionAccess({ via: 'secret', userId: null })],
    ['demo shop session', sessionAccess({ shopId: DEMO_SHOP_ID })],
  ])('leaves %s unchanged', async (_label, access) => {
    expect(await launchWizardPageRedirect(access)).toBeNull();
    expect(shopFindUnique).not.toHaveBeenCalled();
  });
});

describe('AG: /admin/upgrade purchase page guard (may buy ≠ has Full)', () => {
  it('lets a signed-in SETUP owner in without granting any paid capability', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    expect(await fullUpgradePageRedirect(sessionAccess())).toBeNull();
    expect(await requireAdminProductCapability(sessionAccess(), 'BRANDED_SITE', now)).toBeInstanceOf(Response);
  });

  it('lets a signed-in Free owner in', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ freeBookingActivatedAt: new Date('2026-09-01T00:00:00.000Z') }));
    expect(await fullUpgradePageRedirect(sessionAccess())).toBeNull();
  });

  it('sends Full shops back to the dashboard', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    subscriptionFindFirst.mockResolvedValue(ACTIVE_SUBSCRIPTION);
    expect(await fullUpgradePageRedirect(sessionAccess())).toBe('/admin');
  });

  it('sends a Barber without billing.manage back without loading the plan', async () => {
    expect(await fullUpgradePageRedirect(sessionAccess({ role: 'BARBER', barberId: 'b1' }))).toBe('/admin');
    expect(shopFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['anonymous visitor', null],
    ['guest preview', sessionAccess({ via: 'preview', userId: null })],
    ['legacy secret access', sessionAccess({ via: 'secret', userId: null })],
    ['demo shop session', sessionAccess({ shopId: DEMO_SHOP_ID })],
  ])('sends %s back to /admin', async (_label, access) => {
    expect(await fullUpgradePageRedirect(access)).toBe('/admin');
    expect(shopFindUnique).not.toHaveBeenCalled();
  });

  it('runs server-side before rendering the purchase UI', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/admin/upgrade.astro'), 'utf8');
    expect(source).toContain('export const prerender = false;');
    expect(source).toMatch(/fullUpgradePageRedirect\(await resolveAdminAccess\(Astro\)\)/);
    expect(source).toMatch(/if \(upgradeRedirect\) \{\s*return Astro\.redirect\(upgradeRedirect\);/);
    expect(source).toContain('<FullKersivoUpgradePage client:load />');
  });

  it('SETUP onboarding Review offers Full via the authenticated upgrade checkout', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../components/admin/onboarding/OnboardingWizard.tsx'),
      'utf8',
    );
    expect(source).toMatch(/freeActivationStep \? \(\s*<section[^>]*data-onboarding-plan-choice/);
    expect(source).toContain("startFullKersivoUpgradeCheckout({ returnTo: 'onboarding' })");
  });
});

describe('/admin/launch page wiring', () => {
  it('runs the guard server-side before rendering the wizard', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/admin/launch.astro'), 'utf8');
    expect(source).toContain('export const prerender = false;');
    expect(source).toMatch(/launchWizardPageRedirect\(await resolveAdminAccess\(Astro\)\)/);
    expect(source).toMatch(/if \(launchRedirect\) \{\s*return Astro\.redirect\(launchRedirect\);/);
  });
});
