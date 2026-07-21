import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { BookingStatus, Prisma } from '@prisma/client';

const requireAdminContext = vi.fn();
const bookingFindMany = vi.fn();
const bookingCount = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => bookingFindMany(...args),
      count: (...args: unknown[]) => bookingCount(...args),
    },
  },
}));

import { GET } from './bookings';

function makeContext(url: string): APIContext {
  // GET /api/admin/bookings in these tests only reads request/url from APIContext.
  const ctx = {
    request: new Request(url),
    url: new URL(url),
  } satisfies Pick<APIContext, 'request' | 'url'>;
  return ctx as APIContext;
}

const adminAccess = {
  shopId: 'shop-1',
  userId: 'user-1',
  userName: 'Admin',
  userEmail: 'admin@example.com',
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'member-1',
  barberId: null,
};

function sampleBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    serviceId: 'svc-1',
    barberId: 'barber-1',
    fullName: 'Jamie Client',
    email: 'jamie@example.com',
    phone: null,
    clientId: 'client-1',
    startAt: new Date('2020-01-01T10:00:00.000Z'),
    endAt: new Date('2020-01-01T10:30:00.000Z'),
    status: BookingStatus.BOOKED,
    notes: null,
    rescheduledAt: null,
    paymentRequired: false,
    depositAmountPence: null,
    paymentStatus: null,
    totalPricePence: 2500,
    serviceNameAtBooking: 'Classic Cut',
    servicePricePenceAtBooking: 2500,
    barber: { name: 'Alex' },
    service: { name: 'Fade' },
    client: { tags: ['vip'], avatarUrl: '/avatars/jamie.webp' },
    ...overrides,
  };
}

describe('GET /api/admin/bookings', () => {
  beforeEach(() => {
    requireAdminContext.mockReset();
    bookingFindMany.mockReset();
    bookingCount.mockReset();
    requireAdminContext.mockResolvedValue(adminAccess);
  });

  it('returns 400 for an invalid non-empty status and does not query Prisma', async () => {
    const res = await GET(makeContext('http://localhost/api/admin/bookings?status=NOT_A_REAL_STATUS'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid booking status.' });
    expect(bookingFindMany).not.toHaveBeenCalled();
  });

  it('passes a valid BookingStatus through to Prisma where.status', async () => {
    bookingFindMany.mockResolvedValue([]);

    const res = await GET(makeContext('http://localhost/api/admin/bookings?status=BOOKED'));

    expect(res.status).toBe(200);
    expect(bookingFindMany).toHaveBeenCalledTimes(1);
    const args = bookingFindMany.mock.calls[0]?.[0] as {
      where: { status?: BookingStatus };
    };
    expect(args.where.status).toBe(BookingStatus.BOOKED);
  });

  it('omits status filter when status query param is missing', async () => {
    bookingFindMany.mockResolvedValue([]);

    const res = await GET(makeContext('http://localhost/api/admin/bookings'));

    expect(res.status).toBe(200);
    const args = bookingFindMany.mock.calls[0]?.[0] as {
      where: { status?: BookingStatus };
    };
    expect(args.where.status).toBeUndefined();
  });

  it('omits status filter when status query param is empty', async () => {
    bookingFindMany.mockResolvedValue([]);

    const res = await GET(makeContext('http://localhost/api/admin/bookings?status='));

    expect(res.status).toBe(200);
    const args = bookingFindMany.mock.calls[0]?.[0] as {
      where: { status?: BookingStatus };
    };
    expect(args.where.status).toBeUndefined();
  });

  it('maps historical service name, effective COMPLETED status, and client tags', async () => {
    bookingFindMany.mockResolvedValue([sampleBooking()]);

    const res = await GET(makeContext('http://localhost/api/admin/bookings?date=2020-01-01'));
    const body = (await res.json()) as {
      bookings: Array<{
        status: string;
        service: { name: string };
        clientTags: string[];
        clientAvatarUrl: string | null;
        client?: unknown;
      }>;
    };

    expect(res.status).toBe(200);
    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0]?.service.name).toBe('Classic Cut');
    expect(body.bookings[0]?.status).toBe('COMPLETED');
    expect(body.bookings[0]?.clientTags).toEqual(['vip']);
    expect(body.bookings[0]?.clientAvatarUrl).toBe('/avatars/jamie.webp');
    expect(body.bookings[0]?.client).toBeUndefined();
  });

  it('falls back to legacy select when historical columns are missing (P2022)', async () => {
    const missingColumn = new Prisma.PrismaClientKnownRequestError(
      'The column `Booking.serviceNameAtBooking` does not exist in the current database.',
      {
        code: 'P2022',
        clientVersion: '5.22.0',
        meta: { column: 'Booking.serviceNameAtBooking' },
      },
    );

    const legacyBooking = {
      id: 'booking-legacy',
      serviceId: 'svc-1',
      barberId: 'barber-1',
      fullName: 'Jamie Client',
      email: 'jamie@example.com',
      phone: null,
      clientId: 'client-1',
      startAt: new Date('2020-01-01T10:00:00.000Z'),
      endAt: new Date('2020-01-01T10:30:00.000Z'),
      status: BookingStatus.BOOKED,
      notes: null,
      rescheduledAt: null,
      paymentRequired: false,
      depositAmountPence: null,
      paymentStatus: null,
      totalPricePence: 2500,
      barber: { name: 'Alex' },
      service: { name: 'Fade' },
      client: { tags: ['vip'], avatarUrl: '/avatars/jamie.webp' },
    };

    bookingFindMany.mockRejectedValueOnce(missingColumn).mockResolvedValueOnce([legacyBooking]);

    const res = await GET(makeContext('http://localhost/api/admin/bookings?date=2020-01-01'));
    const body = (await res.json()) as {
      bookings: Array<{
        status: string;
        service: { name: string };
        clientTags: string[];
        clientAvatarUrl: string | null;
        serviceNameAtBooking?: string | null;
      }>;
    };

    expect(res.status).toBe(200);
    expect(bookingFindMany).toHaveBeenCalledTimes(2);

    const secondSelect = (
      bookingFindMany.mock.calls[1]?.[0] as {
        select: Record<string, unknown>;
      }
    ).select;
    expect(secondSelect).not.toHaveProperty('serviceNameAtBooking');
    expect(secondSelect).not.toHaveProperty('servicePricePenceAtBooking');

    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0]?.service.name).toBe('Fade');
    expect(body.bookings[0]?.clientTags).toEqual(['vip']);
    expect(body.bookings[0]?.clientAvatarUrl).toBe('/avatars/jamie.webp');
    expect(body.bookings[0]?.status).toBe('COMPLETED');
  });
});
