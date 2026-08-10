import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const serviceFindFirst = vi.fn();
const getAvailabilitySlots = vi.fn();

vi.mock('../../lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/admin/auth')>();
  return {
    ...actual,
    resolveAdminAccess: (...a: unknown[]) => resolveAdminAccess(...a),
  };
});

vi.mock('../../lib/db/client', () => ({
  prisma: {
    service: { findFirst: (...a: unknown[]) => serviceFindFirst(...a) },
  },
}));

vi.mock('../../lib/booking/service', () => ({
  BookingActionError: class BookingActionError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  getAvailabilitySlots: (...a: unknown[]) => getAvailabilitySlots(...a),
}));

vi.mock('../../lib/db/shopScope', () => ({
  DEMO_SHOP_ID: 'demo-shop',
}));

import { GET } from './availability';

describe('GET /api/availability preview shop scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAvailabilitySlots.mockResolvedValue([]);
  });

  it('scopes to preview shopId', async () => {
    resolveAdminAccess.mockResolvedValue({
      shopId: 'shop_preview',
      via: 'preview',
      userId: null,
      role: 'OWNER',
      permissions: [],
    });
    serviceFindFirst.mockResolvedValue({ id: 'svc_1' });

    const url =
      'http://localhost/api/availability?serviceId=svc_1&barberId=b1&date=2026-08-10';
    await GET({ request: new Request(url) } as unknown as APIContext);

    expect(serviceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'svc_1', shopId: 'shop_preview' },
      }),
    );
  });
});
