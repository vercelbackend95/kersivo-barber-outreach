import { beforeEach, describe, expect, it, vi } from 'vitest';

const barberCreate = vi.fn();
const barberAggregate = vi.fn();
const barberServiceCreateMany = vi.fn();
const availabilityRuleCreateMany = vi.fn();
const serviceFindMany = vi.fn();
const shopInviteCreate = vi.fn();
const shopMemberCreate = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: vi.fn(async () => ({
    shopId: 'shop-1',
    userId: 'user-o',
    role: 'OWNER',
    permissions: ['members.manage', 'members.invite_barber'],
  })),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: vi.fn(() => null),
}));

vi.mock('@/lib/storage/storeAdminAvatar', () => ({
  storeAdminAvatar: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    barber: {
      create: (...a: unknown[]) => barberCreate(...a),
      aggregate: (...a: unknown[]) => barberAggregate(...a),
    },
    barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
    availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
    service: { findMany: (...a: unknown[]) => serviceFindMany(...a) },
    shopInvite: { create: (...a: unknown[]) => shopInviteCreate(...a) },
    shopMember: { create: (...a: unknown[]) => shopMemberCreate(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

import { POST } from './booking-profiles';
import type { APIContext } from 'astro';
import { requireAdminContext as requireAdminContextMock } from '@/lib/admin/auth';
import { requireAnyPermission as requireAnyPermissionMock } from '@/lib/admin/rbac/can';

function ctx(body: unknown, role: string = 'OWNER'): APIContext {
  vi.mocked(requireAdminContextMock).mockResolvedValue({
    shopId: 'shop-1',
    userId: 'user-o',
    role,
    permissions: ['members.manage', 'members.invite_barber'],
  } as never);
  vi.mocked(requireAnyPermissionMock).mockReturnValue(null);
  return {
    request: new Request('http://localhost/api/admin/team/booking-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

const workingHours = [{ dayOfWeek: 0, startMinutes: 540, endMinutes: 1080, active: true }];

describe('POST /api/admin/team/booking-profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAnyPermissionMock).mockReturnValue(null);
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b1',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: null,
      userId: null,
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        barber: {
          create: (...a: unknown[]) => barberCreate(...a),
          aggregate: (...a: unknown[]) => barberAggregate(...a),
        },
        barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
        availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
      }),
    );
  });

  it('creates exactly one standalone Barber with no invite or member', async () => {
    const res = await POST(
      ctx({
        displayName: 'Alex',
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(201);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(barberCreate).toHaveBeenCalledTimes(1);
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Alex',
          active: true,
          shopId: 'shop-1',
        }),
      }),
    );
    const createData = barberCreate.mock.calls[0][0].data;
    expect(createData.userId).toBeUndefined();
    expect(createData.email).toBeUndefined();
    expect(shopInviteCreate).not.toHaveBeenCalled();
    expect(shopMemberCreate).not.toHaveBeenCalled();

    const data = await res.json();
    expect(data.barber.id).toBe('b1');
    expect(data.barber.userId).toBeNull();
  });

  it('requires no email', async () => {
    const res = await POST(
      ctx({
        displayName: 'Alex',
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );
    expect(res.status).toBe(201);
    expect(barberCreate.mock.calls[0][0].data.email).toBeUndefined();
  });

  it('rejects Barber actors', async () => {
    const res = await POST(
      ctx(
        {
          displayName: 'Alex',
          serviceIds: ['svc-1'],
          workingHours,
        },
        'BARBER',
      ),
    );
    expect(res.status).toBe(403);
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('allows Manager actors', async () => {
    const res = await POST(
      ctx(
        {
          displayName: 'Alex',
          serviceIds: ['svc-1'],
          workingHours,
        },
        'MANAGER',
      ),
    );
    expect(res.status).toBe(201);
  });

  it('requires services', async () => {
    const res = await POST(ctx({ displayName: 'Alex', serviceIds: [], workingHours }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/service/i);
  });

  it('requires working days', async () => {
    const res = await POST(ctx({ displayName: 'Alex', serviceIds: ['svc-1'], workingHours: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/working day/i);
  });

  it('rejects partially valid service selection', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    const res = await POST(
      ctx({
        displayName: 'Alex',
        serviceIds: ['svc-1', 'svc-missing'],
        workingHours,
      }),
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('INVALID_SERVICE_SELECTION');
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid dayOfWeek', async () => {
    const res = await POST(
      ctx({
        displayName: 'Alex',
        serviceIds: ['svc-1'],
        workingHours: [{ dayOfWeek: 9, startMinutes: 540, endMinutes: 1080, active: true }],
      }),
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('INVALID_WORKING_HOURS');
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('rolls back Barber when service write fails', async () => {
    barberServiceCreateMany.mockRejectedValue(new Error('service boom'));
    const res = await POST(
      ctx({
        displayName: 'Alex',
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );
    expect(res.status).toBe(500);
  });

  it('rolls back Barber when working-hours write fails', async () => {
    availabilityRuleCreateMany.mockRejectedValue(new Error('hours boom'));
    const res = await POST(
      ctx({
        displayName: 'Alex',
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );
    expect(res.status).toBe(500);
  });
});
