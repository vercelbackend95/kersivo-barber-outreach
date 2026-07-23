import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopMemberFindFirst = vi.fn();
const shopInviteFindFirst = vi.fn();
const shopInviteCreate = vi.fn();
const barberCreate = vi.fn();
const barberAggregate = vi.fn();
const barberServiceCreateMany = vi.fn();
const availabilityRuleCreateMany = vi.fn();
const serviceCount = vi.fn();
const serviceFindMany = vi.fn();
const shopSettingsFindUnique = vi.fn();
const sendShopTeamInviteEmail = vi.fn();
const storeAdminAvatar = vi.fn();

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

vi.mock('@/lib/admin/defaultAvailability', () => ({
  ensureBarberHasAllServices: vi.fn(),
  ensureBarberHasAvailabilityRules: vi.fn(),
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
    },
    barberService: { createMany: (...a: unknown[]) => barberServiceCreateMany(...a) },
    availabilityRule: { createMany: (...a: unknown[]) => availabilityRuleCreateMany(...a) },
    service: {
      count: (...a: unknown[]) => serviceCount(...a),
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

describe('POST /api/admin/team/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopMemberFindFirst.mockResolvedValue(null);
    shopInviteFindFirst.mockResolvedValue(null);
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

  it('creates inactive barber draft + invite for Barber role', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({ id: 'b1' });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 7 });

    const res = await POST(
      ctx({
        email: 'a@b.com',
        role: 'BARBER',
        displayName: 'Alex',
        serviceIds: ['svc-1'],
        workingHours: [
          { dayOfWeek: 0, startMinutes: 540, endMinutes: 1080, active: true },
        ],
      }),
    );

    expect(res.status).toBe(201);
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Alex', active: false, email: 'a@b.com' }),
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

  it('invites non-bookable Manager without creating a barber', async () => {
    shopInviteCreate.mockResolvedValue({
      id: 'inv-2',
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

  it('creates inactive barber seat when non-bookable Manager includes avatar', async () => {
    const { ensureBarberHasAllServices, ensureBarberHasAvailabilityRules } = await import(
      '@/lib/admin/defaultAvailability'
    );
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 1 } });
    barberCreate.mockResolvedValue({ id: 'b-photo' });
    storeAdminAvatar.mockResolvedValue('https://blob.example/morgan.jpg');
    shopInviteCreate.mockResolvedValue({
      id: 'inv-3',
      email: 'm@b.com',
      role: 'MANAGER',
      barberId: 'b-photo',
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
    expect(storeAdminAvatar).toHaveBeenCalled();
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Morgan',
          active: false,
          avatarUrl: 'https://blob.example/morgan.jpg',
        }),
      }),
    );
    expect(ensureBarberHasAllServices).toHaveBeenCalledWith('b-photo', 'shop-1');
    expect(ensureBarberHasAvailabilityRules).toHaveBeenCalledWith('b-photo');
    expect(shopInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'MANAGER',
          bookable: false,
          barberId: 'b-photo',
        }),
      }),
    );
  });

  it('returns 400 without display name', async () => {
    const res = await POST(ctx({ email: 'a@b.com', role: 'BARBER' }));
    expect(res.status).toBe(400);
  });

  it('accepts multipart with optional avatar for bookable invite', async () => {
    serviceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    barberAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    barberCreate.mockResolvedValue({ id: 'b1' });
    barberServiceCreateMany.mockResolvedValue({ count: 1 });
    availabilityRuleCreateMany.mockResolvedValue({ count: 7 });
    storeAdminAvatar.mockResolvedValue('https://blob.example/alex.jpg');

    const form = new FormData();
    form.set('email', 'a@b.com');
    form.set('role', 'BARBER');
    form.set('displayName', 'Alex');
    form.set('bookable', 'true');
    form.set('serviceIds', JSON.stringify(['svc-1']));
    form.set(
      'workingHours',
      JSON.stringify([{ dayOfWeek: 0, startMinutes: 540, endMinutes: 1080, active: true }]),
    );
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
          active: false,
          avatarUrl: 'https://blob.example/alex.jpg',
        }),
      }),
    );
  });
});
