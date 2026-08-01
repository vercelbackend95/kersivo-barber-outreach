import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '@/lib/booking/sandboxBookings';

const resolveAdminAccess = vi.fn();
const createInstantBooking = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/booking/service', () => ({
  BookingActionError: class BookingActionError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  createInstantBooking: (...args: unknown[]) => createInstantBooking(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    rateLimitEvent: { create: vi.fn() },
  },
}));

vi.mock('@/lib/rate-limit/bookingRateLimit', () => ({
  checkBookingRateLimit: () => ({ ok: true }),
}));

import { POST } from './create';

function makeContext(body: unknown, access: unknown = null): APIContext {
  return {
    request: new Request('http://localhost/api/bookings/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

const validPayload = {
  serviceId: 'svc-1',
  barberId: 'barber-1',
  date: '2026-07-20',
  time: '10:00',
  fullName: 'Owner Test',
  email: 'owner@example.com',
};

describe('POST /api/bookings/create', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    createInstantBooking.mockReset();
  });

  it('returns 401 without an owner session and does not create a booking', async () => {
    resolveAdminAccess.mockResolvedValue(null);

    const res = await POST(makeContext(validPayload) as never);
    expect(res.status).toBe(401);
    expect(createInstantBooking).not.toHaveBeenCalled();
  });

  it('returns 401 for secret/legacy access (non-session)', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'secret', shopId: 'demo-shop' });

    const res = await POST(makeContext(validPayload) as never);
    expect(res.status).toBe(401);
    expect(createInstantBooking).not.toHaveBeenCalled();
  });

  it('creates an owner test booking with shopId and TEST notes prefix', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'owner-shop-1' });
    createInstantBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'BOOKED',
      serviceNameAtBooking: 'Fade',
      service: { name: 'Fade' },
      barber: { name: 'Jamie' },
      startAt: new Date('2026-07-20T09:00:00.000Z'),
    });

    const res = await POST(makeContext(validPayload) as never);
    expect(res.status).toBe(200);
    expect(createInstantBooking).toHaveBeenCalledTimes(1);
    expect(createInstantBooking).toHaveBeenCalledWith(
      expect.objectContaining(validPayload),
      expect.objectContaining({
        requiredShopId: 'owner-shop-1',
        notesPrefix: OWNER_TEST_BOOKING_NOTES_PREFIX,
        skipConfirmationEmail: false,
      }),
    );

    const json = await res.json();
    expect(json.booking.id).toBe('booking-1');
    expect(json.booking.sandbox).toBe(true);
  });

  it('forwards Idempotency-Key from header when body omits it', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'owner-shop-1' });
    createInstantBooking.mockResolvedValue({
      id: 'booking-2',
      status: 'BOOKED',
      serviceNameAtBooking: 'Fade',
      service: { name: 'Fade' },
      barber: { name: 'Jamie' },
      startAt: new Date('2026-07-20T09:00:00.000Z'),
    });

    const ctx = {
      request: new Request('http://localhost/api/bookings/create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': 'header-key-abcdef',
        },
        body: JSON.stringify(validPayload),
      }),
    } as unknown as APIContext;

    const res = await POST(ctx as never);
    expect(res.status).toBe(200);
    expect(createInstantBooking).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'header-key-abcdef' }),
      expect.any(Object),
    );
  });
});
