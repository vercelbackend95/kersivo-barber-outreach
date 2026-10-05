import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const requireLinkedBarber = vi.fn();
const requireAdminProductCapability = vi.fn();
const createInstantBooking = vi.fn();
const isDemoShopId = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: (...args: unknown[]) => requireAnyPermission(...args),
}));

vi.mock('@/lib/admin/rbac/scope', () => ({
  requireLinkedBarber: (...args: unknown[]) => requireLinkedBarber(...args),
}));

vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminProductCapability: (...args: unknown[]) =>
    requireAdminProductCapability(...args),
}));

vi.mock('@/lib/booking/service', () => ({
  BookingActionError: class BookingActionError extends Error {
    statusCode: number;
    code?: string;
    constructor(message: string, statusCode = 400, code?: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
  createInstantBooking: (...args: unknown[]) => createInstantBooking(...args),
}));

vi.mock('@/lib/shop/cardPaymentsGate', () => ({
  isDemoShopId: (...args: unknown[]) => isDemoShopId(...args),
}));

import { POST } from './manual';

const ownerAccess = {
  shopId: 'shop-1',
  userId: 'user-owner',
  userName: 'Owner',
  userEmail: 'owner@example.com',
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'member-owner',
  barberId: null,
  permissions: ['bookings.manage'],
};

function ctx(body: unknown, headers?: Record<string, string>): APIContext {
  return {
    request: new Request('http://localhost/api/admin/bookings/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    url: new URL('http://localhost/api/admin/bookings/manual'),
  } as unknown as APIContext;
}

const validBody = {
  serviceId: 'svc-1',
  barberId: 'barber-1',
  date: '2026-10-12',
  time: '10:30',
  fullName: 'Jamie Client',
  email: 'jamie@example.com',
  phone: '07123456789',
  note: 'Walk-in booked by shop.',
};

describe('POST /api/admin/bookings/manual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue(ownerAccess);
    requireAnyPermission.mockReturnValue(null);
    requireLinkedBarber.mockReturnValue(null);
    requireAdminProductCapability.mockResolvedValue({ access: ownerAccess });
    isDemoShopId.mockReturnValue(false);
    createInstantBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'BOOKED',
      serviceNameAtBooking: 'Skin Fade',
      service: { name: 'Skin Fade' },
      barber: { name: 'Alex' },
      startAt: new Date('2026-10-12T09:30:00.000Z'),
      replayed: false,
    });
  });

  it('delegates to the canonical creator as Pay at shop with no payment collection', async () => {
    const res = await POST(ctx(validBody, { 'Idempotency-Key': 'manual-key-1234' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.booking).toMatchObject({
      id: 'booking-1',
      paymentType: 'NONE',
      depositRequired: false,
      replayed: false,
    });
    expect(createInstantBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'svc-1',
        barberId: 'barber-1',
        email: 'jamie@example.com',
        idempotencyKey: 'manual-key-1234',
      }),
      {
        requiredShopId: 'shop-1',
        allowDepositCollection: false,
        ignorePublicActivityPause: true,
        notes: 'Walk-in booked by shop.',
      },
    );
  });

  it('returns 200 for an idempotent replay', async () => {
    createInstantBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'BOOKED',
      serviceNameAtBooking: 'Skin Fade',
      service: { name: 'Skin Fade' },
      barber: { name: 'Alex' },
      startAt: new Date('2026-10-12T09:30:00.000Z'),
      replayed: true,
    });

    const res = await POST(ctx({ ...validBody, idempotencyKey: 'client-key-1234' }));
    expect(res.status).toBe(200);
  });

  it('blocks a Barber from creating in another barber calendar', async () => {
    requireAdminContext.mockResolvedValue({
      ...ownerAccess,
      role: 'BARBER',
      barberId: 'barber-self',
      permissions: ['bookings.self'],
    });

    const res = await POST(ctx(validBody));

    expect(res.status).toBe(403);
    expect(createInstantBooking).not.toHaveBeenCalled();
  });

  it('stops at the product capability gate before booking creation', async () => {
    requireAdminProductCapability.mockResolvedValue(
      new Response(JSON.stringify({ code: 'KERSIVO_UPGRADE_REQUIRED' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await POST(ctx(validBody));

    expect(res.status).toBe(403);
    expect(createInstantBooking).not.toHaveBeenCalled();
  });

  it('rejects invalid customer email before booking creation', async () => {
    const res = await POST(ctx({ ...validBody, email: 'not-an-email' }));

    expect(res.status).toBe(400);
    expect(createInstantBooking).not.toHaveBeenCalled();
  });
});
