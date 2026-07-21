import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();
const clientFindMany = vi.fn();
const bookingFindMany = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      findMany: (...args: unknown[]) => clientFindMany(...args),
    },
    booking: {
      findMany: (...args: unknown[]) => bookingFindMany(...args),
    },
  },
}));

vi.mock('./clients/[clientId]/index', () => ({
  computeClientStats: () => ({
    totalBookings: 1,
    completedCount: 1,
    noShowCount: 0,
    lastVisitAt: new Date('2026-06-01T10:00:00.000Z'),
    totalSpentPence: 4500,
    avgSpendPence: 4500,
    favouriteService: 'Fade',
  }),
  computeReliabilityScore: () => 70,
}));

import { GET } from './clients';

function makeContext(url = 'http://localhost/api/admin/clients'): APIContext {
  return {
    request: new Request(url),
    url: new URL(url),
  } as unknown as APIContext;
}

const sampleClient = {
  id: 'client-1',
  fullName: 'Jamie Client',
  email: 'jamie@example.com',
  phone: null,
  tags: ['vip'],
  avatarUrl: null,
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

describe('GET /api/admin/clients Barber visibility', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    clientFindMany.mockReset();
    bookingFindMany.mockReset();
    clientFindMany.mockResolvedValue([sampleClient]);
    bookingFindMany.mockResolvedValue([]);
  });

  it('returns shop clients for unlinked BARBER without totalSpentPence', async () => {
    requireAdminPermission.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-b',
      userName: 'Barber',
      userEmail: 'barber@example.com',
      userImage: null,
      via: 'session',
      role: 'BARBER',
      memberId: 'm-b',
      barberId: null,
      permissions: [],
    });

    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.financialsHidden).toBe(true);
    expect(body.clients).toHaveLength(1);
    expect(body.clients[0].id).toBe('client-1');
    expect(body.clients[0].totalSpentPence).toBeUndefined();
    expect(clientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop-1' },
      }),
    );
  });

  it('includes totalSpentPence for OWNER', async () => {
    requireAdminPermission.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-o',
      userName: 'Owner',
      userEmail: 'owner@example.com',
      userImage: null,
      via: 'session',
      role: 'OWNER',
      memberId: 'm-o',
      barberId: null,
      permissions: [],
    });

    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.financialsHidden).toBe(false);
    expect(body.clients[0].totalSpentPence).toBe(4500);
  });
});
