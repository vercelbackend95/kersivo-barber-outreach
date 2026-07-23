import { beforeEach, describe, expect, it, vi } from 'vitest';

const setOnlineBookingsEnabled = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: vi.fn(),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: vi.fn(),
}));

vi.mock('@/lib/admin/setOnlineBookingsEnabled', () => ({
  setOnlineBookingsEnabled: (...a: unknown[]) => setOnlineBookingsEnabled(...a),
}));

import { PATCH } from './online-bookings';
import type { APIContext } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';

function ctx(barberId: string, body: unknown, role = 'OWNER'): APIContext {
  vi.mocked(requireAdminContext).mockResolvedValue({
    shopId: 'shop-1',
    userId: 'user-o',
    role,
    permissions: role === 'BARBER' ? ['bookings.self'] : ['members.manage', 'catalog.manage'],
  } as never);
  vi.mocked(requireAnyPermission).mockImplementation(() => {
    if (role === 'BARBER') {
      return new Response(JSON.stringify({ error: 'Forbidden.' }), { status: 403 });
    }
    return null;
  });
  return {
    params: { barberId },
    request: new Request(`http://localhost/api/admin/team/booking-profiles/${barberId}/online-bookings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('PATCH /api/admin/team/booking-profiles/[barberId]/online-bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnlineBookingsEnabled.mockResolvedValue({ ok: true, active: true });
  });

  it('allows Owner to enable online bookings', async () => {
    const res = await PATCH(ctx('b1', { enabled: true }, 'OWNER'));
    expect(res.status).toBe(200);
    expect(setOnlineBookingsEnabled).toHaveBeenCalledWith({
      shopId: 'shop-1',
      barberId: 'b1',
      enabled: true,
    });
    const data = await res.json();
    expect(data).toEqual({ ok: true, enabled: true, barberId: 'b1' });
  });

  it('allows Manager to disable online bookings', async () => {
    setOnlineBookingsEnabled.mockResolvedValue({ ok: true, active: false });
    const res = await PATCH(ctx('b1', { enabled: false }, 'MANAGER'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(false);
  });

  it('rejects Barber actors', async () => {
    const res = await PATCH(ctx('b1', { enabled: true }, 'BARBER'));
    expect(res.status).toBe(403);
    expect(setOnlineBookingsEnabled).not.toHaveBeenCalled();
  });

  it('forwards structured 422 from the domain helper', async () => {
    setOnlineBookingsEnabled.mockResolvedValue({
      ok: false,
      status: 422,
      code: 'ONLINE_BOOKING_SETUP_INCOMPLETE',
      error: 'Assign at least one service before enabling online bookings.',
      missing: ['services'],
    });
    const res = await PATCH(ctx('b1', { enabled: true }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('ONLINE_BOOKING_SETUP_INCOMPLETE');
    expect(data.missing).toEqual(['services']);
  });
});
