import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermissionAndCapability = vi.fn();
const adminProductCapabilityEnforced = vi.fn();
const loadKersivoAccess = vi.fn();
const hasKersivoCapability = vi.fn();
const assertClientAccessible = vi.fn();
const canViewClientEmail = vi.fn();
const clientFindFirst = vi.fn();
const bookingFindMany = vi.fn();

vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminPermissionAndCapability: (...args: unknown[]) =>
    requireAdminPermissionAndCapability(...args),
  adminProductCapabilityEnforced: (...args: unknown[]) =>
    adminProductCapabilityEnforced(...args),
}));

vi.mock('@/lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
  hasKersivoCapability: (...args: unknown[]) => hasKersivoCapability(...args),
}));

vi.mock('@/lib/admin/rbac/scope', () => ({
  assertClientAccessible: (...args: unknown[]) => assertClientAccessible(...args),
  canViewClientEmail: (...args: unknown[]) => canViewClientEmail(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      findFirst: (...args: unknown[]) => clientFindFirst(...args),
    },
    booking: {
      findMany: (...args: unknown[]) => bookingFindMany(...args),
    },
  },
}));

import { GET } from './index';

const access = {
  shopId: 'shop-1',
  userId: 'user-1',
  userName: 'Owner',
  userEmail: 'owner@example.com',
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'member-1',
  barberId: null,
  permissions: [],
};

function context(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/clients/client-1'),
    url: new URL('http://localhost/api/admin/clients/client-1'),
    params: { clientId: 'client-1' },
  } as unknown as APIContext;
}

describe('GET /api/admin/clients/[clientId] Clients Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));

    requireAdminPermissionAndCapability.mockResolvedValue(access);
    adminProductCapabilityEnforced.mockReturnValue(true);
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING', capabilities: ['CLIENTS_CORE'] });
    hasKersivoCapability.mockImplementation(
      (productAccess: { capabilities?: string[] }, capability: string) =>
        productAccess.capabilities?.includes(capability) ?? false,
    );
    assertClientAccessible.mockResolvedValue(null);
    canViewClientEmail.mockReturnValue(true);

    clientFindFirst.mockResolvedValue({
      id: 'client-1',
      shopId: 'shop-1',
      fullName: 'Jamie Client',
      email: 'jamie@example.com',
      phone: '07123456789',
      avatarUrl: '/private-advanced-avatar.webp',
      tags: ['vip'],
      notes: 'advanced note',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    });

    bookingFindMany.mockResolvedValue([
      {
        status: 'BOOKED',
        startAt: new Date('2026-10-12T10:00:00.000Z'),
        endAt: new Date('2026-10-12T10:30:00.000Z'),
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
        paymentRequired: false,
        paymentStatus: null,
        totalPricePence: 3000,
        serviceNameAtBooking: 'Fade',
        service: { name: 'Fade' },
      },
      {
        status: 'BOOKED',
        startAt: new Date('2026-09-20T10:00:00.000Z'),
        endAt: new Date('2026-09-20T10:30:00.000Z'),
        updatedAt: new Date('2026-09-20T10:30:00.000Z'),
        paymentRequired: false,
        paymentStatus: null,
        totalPricePence: 3000,
        serviceNameAtBooking: 'Fade',
        service: { name: 'Fade' },
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns only contact + bounded operational booking context for Starter', async () => {
    const res = await GET(context());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      mode: 'core',
      client: {
        id: 'client-1',
        fullName: 'Jamie Client',
        email: 'jamie@example.com',
        phone: '07123456789',
      },
      lastVisitAt: '2026-09-20T10:00:00.000Z',
      nextBookingAt: '2026-10-12T10:00:00.000Z',
      emailHidden: false,
    });

    expect(body.client.avatarUrl).toBeUndefined();
    expect(body.client.tags).toBeUndefined();
    expect(body.client.notes).toBeUndefined();
    expect(body.stats).toBeUndefined();
    expect(body.reliabilityScore).toBeUndefined();
    expect(body.retailStats).toBeUndefined();
    expect(body.lastOrder).toBeUndefined();

    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'client-1',
          OR: expect.any(Array),
        }),
      }),
    );
  });
});
