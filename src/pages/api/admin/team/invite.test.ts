import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopMemberFindFirst = vi.fn();
const shopInviteFindFirst = vi.fn();
const shopInviteCreate = vi.fn();
const barberCreate = vi.fn();
const barberAggregate = vi.fn();
const barberFindFirst = vi.fn();
const barberServiceCreateMany = vi.fn();
const availabilityRuleCreateMany = vi.fn();
const serviceFindMany = vi.fn();
const shopSettingsFindUnique = vi.fn();
const sendShopTeamInviteEmail = vi.fn();
const storeAdminAvatar = vi.fn();

function txClient() {
  return {
    shopMember: { findFirst: (...a: unknown[]) => shopMemberFindFirst(...a) },
    shopInvite: {
      findFirst: (...a: unknown[]) => shopInviteFindFirst(...a),
      create: (...a: unknown[]) => shopInviteCreate(...a),
    },
    barber: {
      create: (...a: unknown[]) => barberCreate(...a),
      aggregate: (...a: unknown[]) => barberAggregate(...a),
      findFirst: (...a: unknown[]) => barberFindFirst(...a),
    },
    barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
    availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
    service: { findMany: (...a: unknown[]) => serviceFindMany(...a) },
  };
}

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: vi.fn(async () => ({
    shopId: 'shop-1',
    userId: 'user-o',
    role: 'OWNER',
    permissions: ['members.manage'],
  })),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: vi.fn(() => null),
}));

vi.mock('@/lib/admin/rbac/members', () => ({
  assertCanInviteRole: vi.fn(async () => null),
  createInviteToken: vi.fn(() => ({ token: 'tok', tokenHash: 'hash' })),
  inviteExpiresAt: vi.fn(() => new Date('2026-08-01T00:00:00.000Z')),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'http://localhost:4321',
}));

vi.mock('@/lib/email/sender', () => ({
  sendShopTeamInviteEmail: (...args: unknown[]) => sendShopTeamInviteEmail(...args),
}));

vi.mock('@/lib/storage/storeAdminAvatar', () => ({
  storeAdminAvatar: (...args: unknown[]) => storeAdminAvatar(...args),
}));

vi.mock('@/lib/db/serializableTransaction', () => ({
  runSerializableTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient()),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: { findFirst: (...a: unknown[]) => shopMemberFindFirst(...a) },
    shopInvite: {
      findFirst: (...a: unknown[]) => shopInviteFindFirst(...a),
      create: (...a: unknown[]) => shopInviteCreate(...a),
    },
    barber: {
      create: (...a: unknown[]) => barberCreate(...a),
      aggregate: (...a: unknown[]) => barberAggregate(...a),
      findFirst: (...a: unknown[]) => barberFindFirst(...a),
    },
    barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
    availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
    service: {
      findMany: (...a: unknown[]) => serviceFindMany(...a),
    },
    shopSettings: { findUnique: (...a: unknown[]) => shopSettingsFindUnique(...a) },
  },
}));

import { POST } from './invite';
import type { APIContext } from 'astro';

function ctx(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

const workingHours = [{ dayOfWeek: 0, startMinutes: 540, endMinutes: 1080, active: true }];

describe('POST /api/admin/team/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopMemberFindFirst.mockResolvedValue(null);
    shopInviteFindFirst.mockResolvedValue(null);
    barberFindFirst.mockResolvedValue(null);
    shopSettingsFindUnique.mockResolvedValue({ name: 'Shop' });
    sendShopTeamInviteEmail.mockResolvedValue(undefined);
    shopInviteCreate.mockResolvedValue({
      id: 'inv-1',
      email: 'a@b.com',
      role: 'BARBER',
      barberId: 'b1',
      displayName: 'Alex',
      bookable: true,
      expiresAt: new Date(),
    });
  });

  it('creates active Barber + linked invite when Barber has online bookings on', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b1',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: 'a@b.com',
      userId: null,
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.emailSent).toBe(true);
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Alex', active: true, email: 'a@b.com' }),
      }),
    );
    expect(shopInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barberId: 'b1',
          bookable: true,
          displayName: 'Alex',
          role: 'BARBER',
        }),
      }),
    );
  });

  it('creates invite without Barber when Barber has online bookings off', async () => {
    shopInviteCreate.mockResolvedValue({
      id: 'inv-2',
      email: 'a@b.com',
      role: 'BARBER',
      barberId: null,
      displayName: 'Alex',
      bookable: false,
      expiresAt: new Date(),
    });

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: false,
      }),
    );

    expect(res.status).toBe(201);
    expect(barberCreate).not.toHaveBeenCalled();
    expect(shopInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'BARBER',
          bookable: false,
          barberId: null,
        }),
      }),
    );
  });

  it('does not force Barber invitations to be bookable', async () => {
    shopInviteCreate.mockResolvedValue({
      id: 'inv-force',
      email: 'a@b.com',
      role: 'BARBER',
      barberId: null,
      displayName: 'Alex',
      bookable: false,
      expiresAt: new Date(),
    });

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: false,
      }),
    );
    expect(res.status).toBe(201);
    const createArg = shopInviteCreate.mock.calls[0][0];
    expect(createArg.data.bookable).toBe(false);
  });

  it('invites dashboard-only Manager without creating a Barber', async () => {
    shopInviteCreate.mockResolvedValue({
      id: 'inv-3',
      email: 'm@b.com',
      role: 'MANAGER',
      barberId: null,
      displayName: 'Morgan',
      bookable: false,
      expiresAt: new Date(),
    });

    const res = await POST(
      ctx({
        email: 'm@b.com',
        role: 'MANAGER',
        displayName: 'Morgan',
        bookable: false,
      }),
    );

    expect(res.status).toBe(201);
    expect(barberCreate).not.toHaveBeenCalled();
    expect(shopInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'MANAGER',
          bookable: false,
          barberId: null,
        }),
      }),
    );
  });

  it('does not create a Barber when non-bookable Manager includes avatar', async () => {
    shopInviteCreate.mockResolvedValue({
      id: 'inv-4',
      email: 'm@b.com',
      role: 'MANAGER',
      barberId: null,
      displayName: 'Morgan',
      bookable: false,
      expiresAt: new Date(),
    });

    const form = new FormData();
    form.set('email', 'm@b.com');
    form.set('role', 'MANAGER');
    form.set('displayName', 'Morgan');
    form.set('bookable', 'false');
    form.set('avatar', new File([new Uint8Array([1, 2, 3])], 'morgan.jpg', { type: 'image/jpeg' }));

    const res = await POST({
      request: new Request('http://localhost/api/admin/team/invite', {
        method: 'POST',
        body: form,
      }),
    } as unknown as APIContext);

    expect(res.status).toBe(201);
    expect(storeAdminAvatar).not.toHaveBeenCalled();
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('creates active Barber + linked invite for Manager with online bookings on', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b-mgr',
      name: 'Morgan',
      active: true,
      avatarUrl: null,
      email: 'm@b.com',
      userId: null,
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });
    shopInviteCreate.mockResolvedValue({
      id: 'inv-5',
      email: 'm@b.com',
      role: 'MANAGER',
      barberId: 'b-mgr',
      displayName: 'Morgan',
      bookable: true,
      expiresAt: new Date(),
    });

    const res = await POST(
      ctx({
        email: 'm@b.com',
        role: 'MANAGER',
        displayName: 'Morgan',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(201);
    expect(barberCreate).toHaveBeenCalledTimes(1);
    expect(shopInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'MANAGER',
          bookable: true,
          barberId: 'b-mgr',
        }),
      }),
    );
  });

  it('requires email for invitations', async () => {
    const res = await POST(ctx({ role: 'BARBER', displayName: 'Alex', bookable: false }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email/i);
  });

  it('requires services when online bookings on', async () => {
    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: [],
        workingHours,
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/service/i);
  });

  it('requires working days when online bookings on', async () => {
    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours: [],
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/working day/i);
  });

  it('returns 400 without display name', async () => {
    const res = await POST(ctx({ email: 'a@b.com', role: 'BARBER', bookable: false }));
    expect(res.status).toBe(400);
  });

  it('accepts multipart avatar for bookable invite with active Barber', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b1',
      name: 'Alex',
      active: true,
      avatarUrl: 'https://blob.example/alex.jpg',
      email: 'a@b.com',
      userId: null,
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });
    storeAdminAvatar.mockResolvedValue('https://blob.example/alex.jpg');

    const form = new FormData();
    form.set('email', 'a@b.com');
    form.set('role', 'BARBER');
    form.set('displayName', 'Alex');
    form.set('bookable', 'true');
    form.set('serviceIds', JSON.stringify(['svc-1']));
    form.set('workingHours', JSON.stringify(workingHours));
    form.set('avatar', new File([new Uint8Array([1, 2, 3])], 'alex.jpg', { type: 'image/jpeg' }));

    const res = await POST({
      request: new Request('http://localhost/api/admin/team/invite', {
        method: 'POST',
        body: form,
      }),
    } as unknown as APIContext);

    expect(res.status).toBe(201);
    expect(storeAdminAvatar).toHaveBeenCalled();
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Alex',
          active: true,
          avatarUrl: 'https://blob.example/alex.jpg',
        }),
      }),
    );
  });

  it('blocks unexpired pending invitation', async () => {
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-open',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: false,
      }),
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('INVITATION_ALREADY_PENDING');
    expect(shopInviteCreate).not.toHaveBeenCalled();
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('blocks expired invitation without creating another Barber', async () => {
    shopInviteFindFirst.mockResolvedValue({
      id: 'inv-expired',
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('EXPIRED_INVITATION_EXISTS');
    expect(data.inviteId).toBe('inv-expired');
    expect(barberCreate).not.toHaveBeenCalled();
    expect(shopInviteCreate).not.toHaveBeenCalled();
  });

  it('blocks bookable invite when Barber email already exists', async () => {
    barberFindFirst.mockResolvedValue({ id: 'b-existing' });
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('BOOKING_PROFILE_ALREADY_EXISTS');
    expect(data.barberId).toBe('b-existing');
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('reports emailSent false when email delivery fails without removing invite', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b1',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: 'a@b.com',
      userId: null,
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });
    sendShopTeamInviteEmail.mockRejectedValue(new Error('smtp down'));

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.emailSent).toBe(false);
    expect(data.warning).toMatch(/could not be sent/i);
    expect(shopInviteCreate).toHaveBeenCalled();
  });

  it('rejects partial service selection', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1', 'bad'],
        workingHours,
      }),
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('INVALID_SERVICE_SELECTION');
    expect(shopInviteCreate).not.toHaveBeenCalled();
  });

  it('rolls back Barber when invite create fails', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b1',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: 'a@b.com',
      userId: null,
    });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 1 });
    shopInviteCreate.mockRejectedValue(new Error('invite boom'));

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(500);
  });

  it('creates no invite when service write fails', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({
      id: 'b1',
      name: 'Alex',
      active: true,
      avatarUrl: null,
      email: 'a@b.com',
      userId: null,
    });
    barberServiceCreateMany.mockRejectedValue(new Error('svc boom'));

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(500);
    expect(shopInviteCreate).not.toHaveBeenCalled();
  });

  it('returns 422 and creates nothing when services fail inside the transaction', async () => {
    serviceFindMany
      .mockResolvedValueOnce([{ id: 'svc-1' }])
      .mockResolvedValueOnce([]);

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        bookable: true,
        serviceIds: ['svc-1'],
        workingHours,
      }),
    );

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('INVALID_SERVICE_SELECTION');
    expect(barberCreate).not.toHaveBeenCalled();
    expect(shopInviteCreate).not.toHaveBeenCalled();
    expect(sendShopTeamInviteEmail).not.toHaveBeenCalled();
  });
});
