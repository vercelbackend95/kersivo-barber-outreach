import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  requireAdminContext,
  requireAnyPermission,
  shopMemberFindFirst,
  shopMemberFindMany,
  shopMemberUpdate,
  barberFindFirst,
  barberFindMany,
  barberCreate,
  barberUpdate,
  barberAggregate,
  barberServiceCreateMany,
  availabilityRuleCreateMany,
  availabilityRuleDeleteMany,
  serviceFindMany,
  shopInviteCreate,
  shopInviteFindMany,
  shopMemberCreate,
  sendShopTeamInviteEmail,
  storeAdminAvatar,
} = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  requireAnyPermission: vi.fn(() => null),
  shopMemberFindFirst: vi.fn(),
  shopMemberFindMany: vi.fn(),
  shopMemberUpdate: vi.fn(),
  barberFindFirst: vi.fn(),
  barberFindMany: vi.fn(),
  barberCreate: vi.fn(),
  barberUpdate: vi.fn(),
  barberAggregate: vi.fn(),
  barberServiceCreateMany: vi.fn(),
  availabilityRuleCreateMany: vi.fn(),
  availabilityRuleDeleteMany: vi.fn(),
  serviceFindMany: vi.fn(),
  shopInviteCreate: vi.fn(),
  shopInviteFindMany: vi.fn(),
  shopMemberCreate: vi.fn(),
  sendShopTeamInviteEmail: vi.fn(),
  storeAdminAvatar: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext,
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission,
}));

vi.mock('@/lib/storage/storeAdminAvatar', () => ({
  storeAdminAvatar,
}));

vi.mock('@/lib/email/sender', () => ({
  sendShopTeamInviteEmail,
}));

vi.mock('@/lib/db/serializableTransaction', () => ({
  runSerializableTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      shopMember: {
        findFirst: (...a: unknown[]) => shopMemberFindFirst(...a),
        findMany: (...a: unknown[]) => shopMemberFindMany(...a),
        update: (...a: unknown[]) => shopMemberUpdate(...a),
        create: (...a: unknown[]) => shopMemberCreate(...a),
      },
      barber: {
        findFirst: (...a: unknown[]) => barberFindFirst(...a),
        findMany: (...a: unknown[]) => barberFindMany(...a),
        create: (...a: unknown[]) => barberCreate(...a),
        update: (...a: unknown[]) => barberUpdate(...a),
        aggregate: (...a: unknown[]) => barberAggregate(...a),
      },
      barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
      availabilityRule: {
        createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a),
        deleteMany: (...a: unknown[]) => availabilityRuleDeleteMany(...a),
      },
      service: { findMany: (...a: unknown[]) => serviceFindMany(...a) },
      shopInvite: {
        create: (...a: unknown[]) => shopInviteCreate(...a),
        findMany: (...a: unknown[]) => shopInviteFindMany(...a),
      },
    }),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: { findMany: (...a: unknown[]) => serviceFindMany(...a) },
    shopOpeningHours: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { POST } from './booking-profile';

function makeMultipart(fields: Record<string, string>, memberId = 'mem-1'): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return {
    params: { memberId },
    request: new Request(
      `http://localhost/api/admin/team/members/${memberId}/booking-profile`,
      { method: 'POST', body: form },
    ),
  } as unknown as APIContext;
}

const workingHours = JSON.stringify([
  { dayOfWeek: 1, startMinutes: 540, endMinutes: 1080, active: true },
]);

function baseMember(overrides: Record<string, unknown> = {}): {
  id: string;
  userId: string;
  role: string;
  barberId: string | null;
  teamStatus: string;
  user: { id: string; name: string; email: string; image: string | null };
} {
  return {
    id: 'mem-1',
    userId: 'user-1',
    role: 'BARBER',
    barberId: null,
    teamStatus: 'ACTIVE',
    user: {
      id: 'user-1',
      name: 'Alex',
      email: 'alex@example.com',
      image: null,
    },
    ...overrides,
  };
}

describe('POST /api/admin/team/members/[memberId]/booking-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-o',
      role: 'OWNER',
      permissions: ['members.manage', 'members.invite_barber'],
    });
    requireAnyPermission.mockReturnValue(null);
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberFindFirst.mockResolvedValue(null);
    barberFindMany.mockResolvedValue([]);
    shopMemberFindMany.mockResolvedValue([]);
    shopInviteFindMany.mockResolvedValue([]);
    shopMemberFindFirst.mockResolvedValue(baseMember());
    shopMemberUpdate.mockResolvedValue({ id: 'mem-1' });
    barberUpdate.mockResolvedValue({
      id: 'b-new',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: 'alex@example.com',
      userId: 'user-1',
    });
    barberCreate.mockResolvedValue({
      id: 'b-new',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: 'alex@example.com',
      userId: 'user-1',
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleDeleteMany.mockResolvedValue({ count: 0 });
  });

  it('creates one Barber linked to ShopMember userId and sets barberId', async () => {
    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.barber.id).toBe('b-new');
    expect(body.barber.active).toBe(true);
    expect(body.barber.userId).toBe('user-1');
    expect(body.barber.email).toBe('alex@example.com');
    expect(body.barber.serviceIds).toEqual(['svc-1']);
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          email: 'alex@example.com',
          active: true,
          name: 'Alex',
        }),
      }),
    );
    expect(shopMemberUpdate).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: { barberId: 'b-new' },
      select: { id: true },
    });
    expect(shopInviteCreate).not.toHaveBeenCalled();
    expect(shopMemberCreate).not.toHaveBeenCalled();
    expect(sendShopTeamInviteEmail).not.toHaveBeenCalled();
    expect(barberServiceCreateMany).toHaveBeenCalled();
    expect(availabilityRuleCreateMany).toHaveBeenCalled();
  });

  it('returns 404 for missing or cross-shop member', async () => {
    shopMemberFindFirst.mockResolvedValue(null);
    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('TEAM_MEMBER_NOT_FOUND');
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when ShopMember already has barberId', async () => {
    shopMemberFindFirst.mockResolvedValue(baseMember({ barberId: 'b-existing' }));
    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('BOOKING_PROFILE_ALREADY_EXISTS');
    expect(body.barberId).toBe('b-existing');
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when User already linked to another Barber', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b-other' });
    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('USER_ALREADY_HAS_BOOKING_PROFILE');
    expect(barberCreate).not.toHaveBeenCalled();
    expect(shopMemberUpdate).not.toHaveBeenCalled();
  });

  it('Owner may set up Owner member', async () => {
    shopMemberFindFirst.mockResolvedValue(baseMember({ role: 'OWNER', userId: 'user-o' }));
    barberCreate.mockResolvedValue({
      id: 'b-owner',
      name: 'Owner',
      active: true,
      avatarUrl: null,
      email: 'owner@example.com',
      userId: 'user-o',
    });
    const res = await POST(
      makeMultipart({
        displayName: 'Owner',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(201);
  });

  it('Manager may set up Barber member only', async () => {
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-m',
      role: 'MANAGER',
      permissions: ['members.invite_barber'],
    });
    const ok = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(ok.status).toBe(201);

    shopMemberFindFirst.mockResolvedValue(baseMember({ role: 'MANAGER' }));
    const denied = await POST(
      makeMultipart({
        displayName: 'Mgr',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(denied.status).toBe(403);
    expect(barberCreate).toHaveBeenCalledTimes(1);
  });

  it('Manager cannot set up Owner member', async () => {
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-m',
      role: 'MANAGER',
      permissions: ['members.invite_barber'],
    });
    shopMemberFindFirst.mockResolvedValue(baseMember({ role: 'OWNER' }));
    const res = await POST(
      makeMultipart({
        displayName: 'Owner',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(403);
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('Barber actor cannot use the endpoint', async () => {
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-b',
      role: 'BARBER',
      permissions: [],
    });
    shopMemberFindFirst.mockResolvedValue(baseMember());
    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(403);
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('invalid services create no Barber', async () => {
    serviceFindMany.mockResolvedValue([]);
    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['missing']),
        workingHours,
      }),
    );
    expect(res.status).toBe(422);
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('invalid hours create no Barber', async () => {
    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours: JSON.stringify([
          { dayOfWeek: 1, startMinutes: 1080, endMinutes: 540, active: true },
        ]),
      }),
    );
    expect(res.status).toBe(422);
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('concurrent second setup returns BOOKING_PROFILE_ALREADY_EXISTS without second Barber', async () => {
    let member: ReturnType<typeof baseMember> = baseMember();
    shopMemberFindFirst.mockImplementation(async () => ({ ...member }));
    shopMemberUpdate.mockImplementation(async () => {
      member = { ...member, barberId: 'b-new' };
      return { id: 'mem-1' };
    });

    const first = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(first.status).toBe(201);

    const second = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.code).toBe('BOOKING_PROFILE_ALREADY_EXISTS');
    expect(barberCreate).toHaveBeenCalledTimes(1);
    expect(shopMemberUpdate).toHaveBeenCalledTimes(1);
  });

  it('reuses a single orphan Barber instead of creating a duplicate', async () => {
    barberFindMany.mockResolvedValue([{ id: 'b-orphan', name: 'Alex', avatarUrl: null }]);
    shopMemberFindMany.mockResolvedValue([]);
    shopInviteFindMany.mockResolvedValue([]);
    barberUpdate.mockResolvedValue({
      id: 'b-orphan',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: 'alex@example.com',
      userId: 'user-1',
    });

    const res = await POST(
      makeMultipart({
        displayName: 'Alex',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.barber.id).toBe('b-orphan');
    expect(barberCreate).not.toHaveBeenCalled();
    expect(barberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b-orphan' },
        data: expect.objectContaining({
          userId: 'user-1',
          email: 'alex@example.com',
          active: true,
        }),
      }),
    );
    expect(shopMemberUpdate).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: { barberId: 'b-orphan' },
      select: { id: true },
    });
    expect(availabilityRuleDeleteMany).toHaveBeenCalledWith({ where: { barberId: 'b-orphan' } });
  });

  it('does not reuse an unrelated orphan (e.g. Papi) when setting up Owner', async () => {
    barberFindMany.mockResolvedValue([{ id: 'b-papi', name: 'Papi', avatarUrl: null }]);
    shopMemberFindMany.mockResolvedValue([]);
    shopInviteFindMany.mockResolvedValue([]);

    const res = await POST(
      makeMultipart({
        displayName: 'Bartosz Jasinski',
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.barber.id).toBe('b-new');
    expect(barberCreate).toHaveBeenCalled();
    expect(barberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b-new' },
        data: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('rejects display names longer than 80 characters without creating a Barber', async () => {
    const longName = 'A'.repeat(81);
    const res = await POST(
      makeMultipart({
        displayName: longName,
        serviceIds: JSON.stringify(['svc-1']),
        workingHours,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_DISPLAY_NAME');
    expect(barberCreate).not.toHaveBeenCalled();
  });
});
