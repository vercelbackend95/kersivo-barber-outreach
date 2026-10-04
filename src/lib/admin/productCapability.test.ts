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
  KERSIVO_UPGRADE_REQUIRED,
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
  it('redirects a Free tenant to the launch upgrade dialog', async () => {
    shopFindUnique.mockResolvedValue(shopRow({ freeBookingActivatedAt: new Date('2026-09-01T00:00:00.000Z') }));
    expect(await launchWizardPageRedirect(sessionAccess())).toBe('/admin?upgrade=launch');
  });

  it('redirects a non-entitled SETUP tenant session too', async () => {
    shopFindUnique.mockResolvedValue(shopRow());
    expect(await launchWizardPageRedirect(sessionAccess())).toBe('/admin?upgrade=launch');
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
