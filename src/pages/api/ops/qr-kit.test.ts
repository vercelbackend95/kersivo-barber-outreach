import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const authorizeCronRequest = vi.fn();
const findUnique = vi.fn();
const updateMany = vi.fn();
const findUniqueOrThrow = vi.fn();
const loadKersivoAccess = vi.fn();
const resolveQrDestination = vi.fn();

vi.mock('@/lib/ops/cronAuth', () => ({
  authorizeCronRequest: (...args: unknown[]) => authorizeCronRequest(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopQrKitRequest: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
}));

vi.mock('@/lib/qr/qrDestination', () => ({
  resolveQrDestination: (...args: unknown[]) => resolveQrDestination(...args),
}));

import { PATCH } from './qr-kit';

function ctx(status: string): APIContext {
  return {
    request: new Request('http://localhost/api/ops/qr-kit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: 'request-1',
        status,
      }),
    }),
    url: new URL('http://localhost/api/ops/qr-kit'),
  } as unknown as APIContext;
}

describe('PATCH /api/ops/qr-kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeCronRequest.mockReturnValue(null);
    findUnique.mockResolvedValue({
      id: 'request-1',
      shopId: 'shop-1',
      status: 'APPROVED',
      shop: { id: 'shop-1', bookingSlug: 'fade-studio' },
    });
    updateMany.mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockResolvedValue({
      id: 'request-1',
      shopId: 'shop-1',
      status: 'PRINT_QUEUED',
    });
  });

  it('blocks Full physical print while QR still resolves through the temporary Full fallback', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO' });
    resolveQrDestination.mockReturnValue({
      kind: 'redirect',
      path: '/book/fade-studio',
      source: 'full_kersivo_temporary_slug_fallback',
    });

    const res = await PATCH(ctx('PRINT_QUEUED'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('QR_FULL_DESTINATION_NOT_READY');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('allows Starter APPROVED -> PRINT_QUEUED when the dynamic QR destination is live', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING' });
    resolveQrDestination.mockReturnValue({
      kind: 'redirect',
      path: '/book/fade-studio',
      source: 'free_booking_slug',
    });

    const res = await PATCH(ctx('PRINT_QUEUED'));

    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1', status: 'APPROVED' },
        data: expect.objectContaining({
          status: 'PRINT_QUEUED',
          printQueuedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects an invalid state skip before any destination work', async () => {
    findUnique.mockResolvedValue({
      id: 'request-1',
      shopId: 'shop-1',
      status: 'REQUESTED',
      shop: { id: 'shop-1', bookingSlug: 'fade-studio' },
    });

    const res = await PATCH(ctx('DISPATCHED'));

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('QR_KIT_INVALID_TRANSITION');
    expect(loadKersivoAccess).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
