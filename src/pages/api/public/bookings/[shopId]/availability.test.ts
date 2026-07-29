import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { ANY_BARBER_ID } from '@/lib/booking/constants';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

const getAvailabilitySlots = vi.fn();
const findUniqueShop = vi.fn();
const findFirstService = vi.fn();
const findFirstBarber = vi.fn();
const findUniqueBarberService = vi.fn();

vi.mock('@/lib/booking/service', () => ({
  BookingActionError: class BookingActionError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  getAvailabilitySlots: (...args: unknown[]) => getAvailabilitySlots(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...args: unknown[]) => findUniqueShop(...args) },
    service: { findFirst: (...args: unknown[]) => findFirstService(...args) },
    barber: { findFirst: (...args: unknown[]) => findFirstBarber(...args) },
    barberService: { findUnique: (...args: unknown[]) => findUniqueBarberService(...args) },
  },
}));

import { GET } from './availability';

function makeContext(shopId: string | undefined, query: Record<string, string>): APIContext {
  const params = new URLSearchParams(query);
  return {
    params: { shopId },
    request: new Request(`http://localhost/api/public/bookings/${shopId ?? ''}/availability?${params}`, {
      method: 'GET',
    }),
  } as unknown as APIContext;
}

const shopA = 'shop-a';
const shopB = 'shop-b';
const serviceA = 'svc-a';
const barberA = 'barber-a';
const barberB = 'barber-b';

describe('GET /api/public/bookings/[shopId]/availability', () => {
  beforeEach(() => {
    getAvailabilitySlots.mockReset();
    findUniqueShop.mockReset();
    findFirstService.mockReset();
    findFirstBarber.mockReset();
    findUniqueBarberService.mockReset();
  });

  it('returns 400 when shop id is missing', async () => {
    const res = await GET(
      makeContext(undefined, { serviceId: serviceA, barberId: barberA, date: '2026-07-20' }) as never,
    );
    expect(res.status).toBe(400);
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns 403 for DEMO shop and does not load slots', async () => {
    const res = await GET(
      makeContext(DEMO_SHOP_ID, { serviceId: serviceA, barberId: barberA, date: '2026-07-20' }) as never,
    );
    expect(res.status).toBe(403);
    expect(findUniqueShop).not.toHaveBeenCalled();
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns 404 when shop does not exist', async () => {
    findUniqueShop.mockResolvedValue(null);
    const res = await GET(
      makeContext(shopA, { serviceId: serviceA, barberId: barberA, date: '2026-07-20' }) as never,
    );
    expect(res.status).toBe(404);
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns 400 when required query params are missing', async () => {
    findUniqueShop.mockResolvedValue({ id: shopA });
    const res = await GET(makeContext(shopA, { serviceId: serviceA }) as never);
    expect(res.status).toBe(400);
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid date', async () => {
    findUniqueShop.mockResolvedValue({ id: shopA });
    const res = await GET(
      makeContext(shopA, { serviceId: serviceA, barberId: barberA, date: 'not-a-date' }) as never,
    );
    expect(res.status).toBe(400);
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns 404 for cross-tenant service (shop A path + shop B service)', async () => {
    findUniqueShop.mockResolvedValue({ id: shopA });
    findFirstService.mockResolvedValue(null);

    const res = await GET(
      makeContext(shopA, { serviceId: 'svc-from-shop-b', barberId: barberA, date: '2026-07-20' }) as never,
    );

    expect(res.status).toBe(404);
    expect(findFirstService).toHaveBeenCalledWith({
      where: { id: 'svc-from-shop-b', shopId: shopA },
      select: { id: true },
    });
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns 404 for cross-tenant barber (shop A path + shop B barber)', async () => {
    findUniqueShop.mockResolvedValue({ id: shopA });
    findFirstService.mockResolvedValue({ id: serviceA });
    findFirstBarber.mockResolvedValue(null);

    const res = await GET(
      makeContext(shopA, { serviceId: serviceA, barberId: barberB, date: '2026-07-20' }) as never,
    );

    expect(res.status).toBe(404);
    expect(findFirstBarber).toHaveBeenCalledWith({
      where: { id: barberB, shopId: shopA, active: true },
      select: { id: true },
    });
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns 404 when barber does not offer the service', async () => {
    findUniqueShop.mockResolvedValue({ id: shopA });
    findFirstService.mockResolvedValue({ id: serviceA });
    findFirstBarber.mockResolvedValue({ id: barberA });
    findUniqueBarberService.mockResolvedValue(null);

    const res = await GET(
      makeContext(shopA, { serviceId: serviceA, barberId: barberA, date: '2026-07-20' }) as never,
    );

    expect(res.status).toBe(404);
    expect(getAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('returns slots for a valid same-shop service and barber without requiring a session', async () => {
    findUniqueShop.mockResolvedValue({ id: shopA });
    findFirstService.mockResolvedValue({ id: serviceA });
    findFirstBarber.mockResolvedValue({ id: barberA });
    findUniqueBarberService.mockResolvedValue({ serviceId: serviceA });
    getAvailabilitySlots.mockResolvedValue({
      slots: ['10:00', '10:30'],
      paused: false,
      pauseReason: null,
    });

    const res = await GET(
      makeContext(shopA, { serviceId: serviceA, barberId: barberA, date: '2026-07-20' }) as never,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ slots: ['10:00', '10:30'], paused: false, pauseReason: null });
    expect(getAvailabilitySlots).toHaveBeenCalledWith({
      serviceId: serviceA,
      barberId: barberA,
      date: '2026-07-20',
    });
    expect(res.headers.get('Cache-Control')).toContain('public');
  });

  it('skips barber lookup for ANY_BARBER and still scopes by shop service', async () => {
    findUniqueShop.mockResolvedValue({ id: shopB });
    findFirstService.mockResolvedValue({ id: serviceA });
    getAvailabilitySlots.mockResolvedValue({
      slots: ['11:00'],
      paused: false,
    });

    const res = await GET(
      makeContext(shopB, { serviceId: serviceA, barberId: ANY_BARBER_ID, date: '2026-07-21' }) as never,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.slots).toEqual(['11:00']);
    expect(findFirstBarber).not.toHaveBeenCalled();
    expect(findUniqueBarberService).not.toHaveBeenCalled();
    expect(getAvailabilitySlots).toHaveBeenCalledWith({
      serviceId: serviceA,
      barberId: ANY_BARBER_ID,
      date: '2026-07-21',
    });
  });
});
