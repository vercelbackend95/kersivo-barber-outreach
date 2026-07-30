import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();
const clientFindFirst = vi.fn();
const bookingFindMany = vi.fn();
const orderFindMany = vi.fn();
const shouldIncludeTestActivityInAnalytics = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('@/lib/admin/analyticsMode', () => ({
  shouldIncludeTestActivityInAnalytics: (...args: unknown[]) =>
    shouldIncludeTestActivityInAnalytics(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      findFirst: (...args: unknown[]) => clientFindFirst(...args),
    },
    booking: {
      findMany: (...args: unknown[]) => bookingFindMany(...args),
    },
    order: {
      findMany: (...args: unknown[]) => orderFindMany(...args),
    },
  },
}));

import { GET } from './index';

function makeContext(clientId: string): APIContext {
  const url = `http://localhost/api/admin/clients/${clientId}`;
  return {
    request: new Request(url),
    url: new URL(url),
    params: { clientId },
  } as unknown as APIContext;
}

const baseClient = {
  id: 'client-1',
  shopId: 'shop-1',
  fullName: 'Jamie Client',
  email: 'jamie@example.com',
  phone: '07000000000',
  avatarUrl: null,
  tags: ['vip'],
  notes: 'Legacy private note',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const spendBooking = {
  status: 'COMPLETED',
  startAt: new Date('2026-06-01T10:00:00.000Z'),
  endAt: new Date('2026-06-01T10:30:00.000Z'),
  updatedAt: new Date('2026-06-01T10:30:00.000Z'),
  paymentRequired: true,
  paymentStatus: 'PAID',
  totalPricePence: 4500,
  serviceNameAtBooking: 'Fade',
  service: { name: 'Fade' },
};

describe('GET /api/admin/clients/[clientId] financial visibility', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    clientFindFirst.mockReset();
    bookingFindMany.mockReset();
    orderFindMany.mockReset();
    shouldIncludeTestActivityInAnalytics.mockReset();
    clientFindFirst.mockResolvedValue(baseClient);
    bookingFindMany.mockResolvedValue([spendBooking]);
  });

  it('strips LTV, retail, and legacy notes for BARBER', async () => {
    requireAdminPermission.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-b',
      userName: 'Barber',
      userEmail: 'barber@example.com',
      userImage: null,
      via: 'session',
      role: 'BARBER',
      memberId: 'm-b',
      barberId: 'barber-1',
      permissions: [],
    });

    const res = await GET(makeContext('client-1'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.financialsHidden).toBe(true);
    expect(body.emailHidden).toBe(true);
    expect(body.client.email).toBeNull();
    expect(body.client.notes).toBeNull();
    expect(body.client.tags).toEqual(['vip']);
    expect(body.client.phone).toBe('07000000000');
    expect(body.stats.totalSpentPence).toBe(0);
    expect(body.stats.avgSpendPence).toBe(0);
    expect(body.stats.totalBookings).toBe(1);
    expect(body.stats.favouriteService).toBe('Fade');
    expect(body.retailStats).toEqual({ productsBought: 0, avgSpendPence: 0 });
    expect(body.lastOrder).toBeNull();
    expect(orderFindMany).not.toHaveBeenCalled();
  });

  it('returns LTV, retail, legacy notes, and email for MANAGER', async () => {
    requireAdminPermission.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-m',
      userName: 'Manager',
      userEmail: 'manager@example.com',
      userImage: null,
      via: 'session',
      role: 'MANAGER',
      memberId: 'm-m',
      barberId: null,
      permissions: [],
    });
    shouldIncludeTestActivityInAnalytics.mockResolvedValue(false);
    orderFindMany.mockResolvedValue([
      {
        id: 'order-1',
        status: 'PAID',
        totalPence: 1200,
        paidAt: new Date('2026-06-02T12:00:00.000Z'),
        createdAt: new Date('2026-06-02T12:00:00.000Z'),
        items: [{ nameSnapshot: 'Pomade', quantity: 1 }],
      },
    ]);

    const res = await GET(makeContext('client-1'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.financialsHidden).toBe(false);
    expect(body.emailHidden).toBe(false);
    expect(body.client.email).toBe('jamie@example.com');
    expect(body.client.notes).toBe('Legacy private note');
    expect(body.stats.totalSpentPence).toBe(4500);
    expect(body.stats.avgSpendPence).toBe(4500);
    expect(body.retailStats.productsBought).toBe(1);
    expect(body.lastOrder).not.toBeNull();
    expect(orderFindMany).toHaveBeenCalled();
  });
});
