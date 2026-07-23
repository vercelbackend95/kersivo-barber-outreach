import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopMemberFindFirst = vi.fn();
const barberCreate = vi.fn();
const setOnlineBookingsEnabled = vi.fn();
const ensureBarberHasAllServices = vi.fn();
const ensureBarberHasAvailabilityRules = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: vi.fn(async () => ({
    shopId: 'shop-1',
    userId: 'user-o',
    role: 'OWNER',
    permissions: ['members.manage', 'catalog.manage'],
  })),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: vi.fn(() => null),
}));

vi.mock('@/lib/admin/setOnlineBookingsEnabled', () => ({
  setOnlineBookingsEnabled: (...a: unknown[]) => setOnlineBookingsEnabled(...a),
}));

vi.mock('@/lib/admin/defaultAvailability', () => ({
  ensureBarberHasAllServices: (...a: unknown[]) => ensureBarberHasAllServices(...a),
  ensureBarberHasAvailabilityRules: (...a: unknown[]) => ensureBarberHasAvailabilityRules(...a),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findFirst: (...a: unknown[]) => shopMemberFindFirst(...a),
    },
    barber: {
      create: (...a: unknown[]) => barberCreate(...a),
    },
  },
}));

import { PATCH } from './bookable';
import type { APIContext } from 'astro';

function ctx(memberId: string, body: unknown): APIContext {
  return {
    params: { memberId },
    request: new Request(`http://localhost/api/admin/team/members/${memberId}/bookable`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('PATCH /api/admin/team/members/[memberId]/bookable (compat wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnlineBookingsEnabled.mockResolvedValue({ ok: true, active: true });
  });

  it('delegates to setOnlineBookingsEnabled when member has a booking profile', async () => {
    shopMemberFindFirst.mockResolvedValue({ id: 'm1', barberId: 'b1' });
    const res = await PATCH(ctx('m1', { bookable: true }));
    expect(res.status).toBe(200);
    expect(setOnlineBookingsEnabled).toHaveBeenCalledWith({
      shopId: 'shop-1',
      barberId: 'b1',
      enabled: true,
    });
    expect(barberCreate).not.toHaveBeenCalled();
    expect(ensureBarberHasAllServices).not.toHaveBeenCalled();
    expect(ensureBarberHasAvailabilityRules).not.toHaveBeenCalled();
  });

  it('never creates a Barber when member has no booking profile', async () => {
    shopMemberFindFirst.mockResolvedValue({ id: 'm1', barberId: null });
    const res = await PATCH(ctx('m1', { bookable: true }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('ONLINE_BOOKING_SETUP_REQUIRED');
    expect(barberCreate).not.toHaveBeenCalled();
    expect(setOnlineBookingsEnabled).not.toHaveBeenCalled();
    expect(ensureBarberHasAllServices).not.toHaveBeenCalled();
    expect(ensureBarberHasAvailabilityRules).not.toHaveBeenCalled();
  });

  it('never calls default service or availability helpers on disable', async () => {
    shopMemberFindFirst.mockResolvedValue({ id: 'm1', barberId: 'b1' });
    setOnlineBookingsEnabled.mockResolvedValue({ ok: true, active: false });
    const res = await PATCH(ctx('m1', { bookable: false }));
    expect(res.status).toBe(200);
    expect(ensureBarberHasAllServices).not.toHaveBeenCalled();
    expect(ensureBarberHasAvailabilityRules).not.toHaveBeenCalled();
  });
});
