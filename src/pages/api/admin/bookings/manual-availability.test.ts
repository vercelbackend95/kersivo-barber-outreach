import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const requireLinkedBarber = vi.fn();
const requireAdminProductCapability = vi.fn();
const getAvailabilitySlots = vi.fn();
const serviceFindFirst = vi.fn();
const barberFindFirst = vi.fn();
const barberServiceFindUnique = vi.fn();
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
vi.mock('@/lib/booking/service', () => ({
  BookingActionError: class BookingActionError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  getAvailabilitySlots: (...args: unknown[]) => getAvailabilitySlots(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: { findFirst: (...args: unknown[]) => serviceFindFirst(...args) },
    barber: { findFirst: (...args: unknown[]) => barberFindFirst(...args) },
    barberService: { findUnique: (...args: unknown[]) => barberServiceFindUnique(...args) },
  },
}));
vi.mock('@/lib/shop/cardPaymentsGate', () => ({
  isDemoShopId: (...args: unknown[]) => isDemoShopId(...args),
}));

import { GET } from './manual-availability';

const owner = {
  shopId: 'shop-1',
  userId: 'owner',
  userName: 'Owner',
  userEmail: 'owner@example.com',
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'member-owner',
  barberId: null,
  permissions: ['bookings.manage'],
};

function ctx(barberId = 'barber-1'): APIContext {
  const url = new URL('http://localhost/api/admin/bookings/manual-availability');
  url.searchParams.set('serviceId', 'svc-1');
  url.searchParams.set('barberId', barberId);
  url.searchParams.set('date', '2026-10-12');
  return { request: new Request(url), url } as unknown as APIContext;
}

describe('GET /api/admin/bookings/manual-availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue(owner);
    requireAnyPermission.mockReturnValue(null);
    requireLinkedBarber.mockReturnValue(null);
    requireAdminProductCapability.mockResolvedValue({ access: owner });
    isDemoShopId.mockReturnValue(false);
    serviceFindFirst.mockResolvedValue({ id: 'svc-1' });
    barberFindFirst.mockResolvedValue({ id: 'barber-1' });
    barberServiceFindUnique.mockResolvedValue({ serviceId: 'svc-1' });
    getAvailabilitySlots.mockResolvedValue({ slots: ['10:00', '10:30'] });
  });

  it('uses canonical availability while ignoring only the public pause', async () => {
    const res = await GET(ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ slots: ['10:00', '10:30'] });
    expect(getAvailabilitySlots).toHaveBeenCalledWith({
      serviceId: 'svc-1',
      barberId: 'barber-1',
      date: '2026-10-12',
      ignorePublicActivityPause: true,
    });
  });

  it('blocks a Barber from reading another barber calendar', async () => {
    requireAdminContext.mockResolvedValue({
      ...owner,
      role: 'BARBER',
      barberId: 'barber-self',
      permissions: ['bookings.self'],
    });

    const res = await GET(ctx('barber-other'));

    expect(res.status).toBe(403);
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
    expect(serviceFindFirst).not.toHaveBeenCalled();
  });
});
