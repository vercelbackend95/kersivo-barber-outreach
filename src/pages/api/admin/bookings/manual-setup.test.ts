import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const requireLinkedBarber = vi.fn();
const requireAdminProductCapability = vi.fn();
const serviceFindMany = vi.fn();
const barberFindMany = vi.fn();
const barberServiceFindMany = vi.fn();
const isDemoShopId = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));
vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: (...args: unknown[]) => requireAnyPermission(...args),
}));
vi.mock('@/lib/admin/rbac/scope', () => ({
  requireLinkedBarber: (...args: unknown[]) => requireLinkedBarber(...args),
}));
vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminProductCapability: (...args: unknown[]) => requireAdminProductCapability(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: { findMany: (...args: unknown[]) => serviceFindMany(...args) },
    barber: { findMany: (...args: unknown[]) => barberFindMany(...args) },
    barberService: { findMany: (...args: unknown[]) => barberServiceFindMany(...args) },
  },
}));
vi.mock('@/lib/shop/cardPaymentsGate', () => ({
  isDemoShopId: (...args: unknown[]) => isDemoShopId(...args),
}));

import { GET } from './manual-setup';

const base = {
  shopId: 'shop-1',
  userId: 'user-1',
  userName: 'Barber',
  userEmail: 'barber@example.com',
  userImage: null,
  via: 'session' as const,
  role: 'BARBER' as const,
  memberId: 'member-1',
  barberId: 'barber-self',
  permissions: ['bookings.self'],
};

const context = {
  request: new Request('http://localhost/api/admin/bookings/manual-setup'),
  url: new URL('http://localhost/api/admin/bookings/manual-setup'),
} as unknown as APIContext;

describe('GET /api/admin/bookings/manual-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue(base);
    requireAnyPermission.mockReturnValue(null);
    requireLinkedBarber.mockReturnValue(null);
    requireAdminProductCapability.mockResolvedValue({ access: base });
    isDemoShopId.mockReturnValue(false);
    serviceFindMany.mockResolvedValue([{ id: 'svc-1', name: 'Fade' }]);
    barberFindMany.mockResolvedValue([{ id: 'barber-self', name: 'Alex' }]);
    barberServiceFindMany.mockResolvedValue([{ barberId: 'barber-self', serviceId: 'svc-1' }]);
  });

  it('returns only the signed-in Barber seat as fixedBarberId', async () => {
    const res = await GET(context);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fixedBarberId).toBe('barber-self');
    expect(body.barbers).toEqual([
      { id: 'barber-self', name: 'Alex', serviceIds: ['svc-1'] },
    ]);
    expect(barberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop-1', id: 'barber-self', active: true },
      }),
    );
  });
});
