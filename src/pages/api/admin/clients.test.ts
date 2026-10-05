import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadKersivoAccessMock } = vi.hoisted(() => ({
  loadKersivoAccessMock: vi.fn(),
}));

vi.mock('@/lib/shop/kersivoAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shop/kersivoAccess')>();
  return {
    ...actual,
    loadKersivoAccess: (...args: unknown[]) => loadKersivoAccessMock(...args),
  };
});
import type { APIContext } from 'astro';
import { accessForState } from '@/lib/shop/kersivoAccess';

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
    loadKersivoAccessMock.mockReset();
    loadKersivoAccessMock.mockResolvedValue(accessForState('FULL_KERSIVO'));
    clientFindMany.mockResolvedValue([sampleClient]);
    bookingFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a strict Clients Core payload for Starter without advanced CRM fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
    loadKersivoAccessMock.mockResolvedValue(accessForState('FREE_BOOKING'));
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
    bookingFindMany.mockResolvedValue([
      {
        clientId: 'client-1',
        status: 'BOOKED',
        startAt: new Date('2026-10-10T10:00:00.000Z'),
        endAt: new Date('2026-10-10T10:30:00.000Z'),
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
        paymentRequired: false,
        paymentStatus: null,
        totalPricePence: 3000,
        serviceNameAtBooking: 'Fade',
        service: { name: 'Fade' },
      },
      {
        clientId: 'client-1',
        status: 'BOOKED',
        startAt: new Date('2026-09-20T10:00:00.000Z'),
        endAt: new Date('2026-09-20T10:30:00.000Z'),
        updatedAt: new Date('2026-09-20T10:30:00.000Z'),
        paymentRequired: false,
        paymentStatus: null,
        totalPricePence: 3000,
        serviceNameAtBooking: 'Fade',
        service: { name: 'Fade' },
      },
    ]);

    const res = await GET(makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('core');
    expect(body.financialsHidden).toBe(true);
    expect(body.clients[0]).toEqual({
      id: 'client-1',
      fullName: 'Jamie Client',
      email: 'jamie@example.com',
      phone: null,
      updatedAt: '2026-06-01T00:00:00.000Z',
      lastVisitAt: '2026-09-20T10:00:00.000Z',
      nextBookingAt: '2026-10-10T10:00:00.000Z',
    });
    expect(body.clients[0].tags).toBeUndefined();
    expect(body.clients[0].avatarUrl).toBeUndefined();
    expect(body.clients[0].reliabilityScore).toBeUndefined();
    expect(body.clients[0].totalSpentPence).toBeUndefined();

    const args = bookingFindMany.mock.calls[0]?.[0] as {
      where: { OR?: Array<{ startAt?: { gte?: Date; lt?: Date } }> };
    };
    expect(args.where.OR).toBeDefined();
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
