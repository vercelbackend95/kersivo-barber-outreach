import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, Prisma } from '@prisma/client';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const assertBookingAccessible = vi.fn();

const bookingFindFirst = vi.fn();
const bookingUpdate = vi.fn();
const serviceFindFirst = vi.fn();
const shopSettingsFindUniqueOrThrow = vi.fn();
const barberServiceFindUnique = vi.fn();
const barberTimeOffFindFirst = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: (...args: unknown[]) => requireAnyPermission(...args),
}));

vi.mock('@/lib/admin/rbac/scope', () => ({
  assertBookingAccessible: (...args: unknown[]) => assertBookingAccessible(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    booking: {
      findFirst: (...args: unknown[]) => bookingFindFirst(...args),
      update: (...args: unknown[]) => bookingUpdate(...args),
    },
    service: {
      findFirst: (...args: unknown[]) => serviceFindFirst(...args),
    },
    shopSettings: {
      findUniqueOrThrow: (...args: unknown[]) => shopSettingsFindUniqueOrThrow(...args),
    },
    barberService: {
      findUnique: (...args: unknown[]) => barberServiceFindUnique(...args),
    },
    barberTimeOff: {
      findFirst: (...args: unknown[]) => barberTimeOffFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { PATCH } from './service';

const startAt = new Date('2027-06-15T09:00:00.000Z'); // 10:00 London (BST)
const endAt30 = new Date('2027-06-15T09:30:00.000Z');

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book_1',
    barberId: 'barber_1',
    startAt,
    endAt: endAt30,
    status: BookingStatus.BOOKED,
    ...overrides,
  };
}

function serviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'svc_60',
    shopId: 'shop_1',
    name: 'Cut & Beard',
    pricePence: 3500,
    durationMinutes: 60,
    bufferMinutes: 5,
    isActive: true,
    ...overrides,
  };
}

function ctx(body: unknown = { serviceId: 'svc_60' }, bookingId = 'book_1') {
  return {
    params: { id: bookingId },
    request: new Request(`https://kersivo.test/api/admin/bookings/${bookingId}/service`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never;
}

function mockHappyTransaction() {
  transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    barberTimeOffFindFirst.mockResolvedValue(null);
    bookingUpdate.mockResolvedValue({
      id: 'book_1',
      serviceId: 'svc_60',
      serviceNameAtBooking: 'Cut & Beard',
      servicePricePenceAtBooking: 3500,
      serviceDurationMinutesAtBooking: 60,
      totalPricePence: 3500,
      endAt: new Date('2027-06-15T10:05:00.000Z'),
      updatedAt: new Date('2027-06-15T08:00:00.000Z'),
    });
    const tx = {
      booking: {
        // 1) CAS re-read, 2) overlap check inside ensureSlotAvailable
        findFirst: vi.fn().mockResolvedValueOnce(bookingRow()).mockResolvedValueOnce(null),
        update: bookingUpdate,
      },
      barberTimeOff: {
        findFirst: barberTimeOffFindFirst,
      },
    };
    return fn(tx);
  });
}

describe('PATCH /api/admin/bookings/[id]/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue({
      shopId: 'shop_1',
      role: 'OWNER',
      permissions: ['bookings.manage'],
    });
    requireAnyPermission.mockReturnValue(null);
    assertBookingAccessible.mockResolvedValue({ id: 'book_1' });
    bookingFindFirst.mockResolvedValue(bookingRow());
    serviceFindFirst.mockResolvedValue(serviceRow());
    shopSettingsFindUniqueOrThrow.mockResolvedValue({ defaultBufferMinutes: 0 });
    barberServiceFindUnique.mockResolvedValue({ serviceId: 'svc_60' });
    barberTimeOffFindFirst.mockResolvedValue(null);
    mockHappyTransaction();
  });

  it('updates service with duration + buffer in endAt under Serializable transaction', async () => {
    const response = await PATCH(ctx());
    expect(response.status).toBe(200);

    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    expect(bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book_1' },
        data: expect.objectContaining({
          serviceId: 'svc_60',
          serviceDurationMinutesAtBooking: 60,
          totalPricePence: 3500,
          // 60 duration + 5 buffer = 65 minutes from 09:00Z
          endAt: new Date('2027-06-15T10:05:00.000Z'),
        }),
      }),
    );
  });

  it('uses shop defaultBufferMinutes when service buffer is 0', async () => {
    serviceFindFirst.mockResolvedValue(serviceRow({ bufferMinutes: 0 }));
    shopSettingsFindUniqueOrThrow.mockResolvedValue({ defaultBufferMinutes: 10 });

    const response = await PATCH(ctx());
    expect(response.status).toBe(200);

    expect(bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endAt: new Date('2027-06-15T10:10:00.000Z'),
        }),
      }),
    );
  });

  it('rejects overlapping next booking with 409 (audit scenario)', async () => {
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(bookingRow())
            .mockResolvedValueOnce({ id: 'book_next' }), // overlap
          update: bookingUpdate,
        },
        barberTimeOff: { findFirst: barberTimeOffFindFirst },
      };
      return fn(tx);
    });

    const response = await PATCH(ctx());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/no longer available/i);
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it('rejects barber time-off collision with 409', async () => {
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(bookingRow())
            .mockResolvedValueOnce(null),
          update: bookingUpdate,
        },
        barberTimeOff: {
          findFirst: vi.fn().mockResolvedValue({ id: 'toff_1' }),
        },
      };
      return fn(tx);
    });

    const response = await PATCH(ctx());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/blocked/i);
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it('rejects inactive service with 409', async () => {
    serviceFindFirst.mockResolvedValue(serviceRow({ isActive: false }));

    const response = await PATCH(ctx());
    expect(response.status).toBe(409);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects service not provided by assigned barber with 409', async () => {
    barberServiceFindUnique.mockResolvedValue(null);

    const response = await PATCH(ctx());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/does not provide/i);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects PENDING_PAYMENT with 422', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ status: BookingStatus.PENDING_PAYMENT }));

    const response = await PATCH(ctx());
    expect(response.status).toBe(422);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects CANCELLED_BY_SHOP with 422', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ status: BookingStatus.CANCELLED_BY_SHOP }));

    const response = await PATCH(ctx());
    expect(response.status).toBe(422);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects yesterday BOOKED (effective COMPLETED) with 422', async () => {
    bookingFindFirst.mockResolvedValue(
      bookingRow({
        startAt: new Date('2026-07-01T09:00:00.000Z'),
        endAt: new Date('2026-07-01T09:30:00.000Z'),
        status: BookingStatus.BOOKED,
      }),
    );

    const response = await PATCH(ctx());
    expect(response.status).toBe(422);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('blocks when requireAnyPermission returns 403', async () => {
    requireAnyPermission.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );

    const response = await PATCH(ctx());
    expect(response.status).toBe(403);
    expect(bookingFindFirst).not.toHaveBeenCalled();
  });

  it('blocks cross-shop booking via assertBookingAccessible', async () => {
    assertBookingAccessible.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    );

    const response = await PATCH(ctx({}, 'book_other'));
    expect(response.status).toBe(404);
    expect(bookingFindFirst).not.toHaveBeenCalled();
  });
});
