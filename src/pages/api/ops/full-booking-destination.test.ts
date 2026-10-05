import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireOperatorAccess = vi.fn();
const verifyFullBookingDestination = vi.fn();
const invalidateFullBookingDestination = vi.fn();
const loadFullBookingDestinationOpsView = vi.fn();

vi.mock('@/lib/ops/operatorAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/operatorAuth')>();
  return { ...actual, requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args) };
});

vi.mock('@/lib/shop/fullBookingDestination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shop/fullBookingDestination')>();
  return {
    ...actual,
    verifyFullBookingDestination: (...args: unknown[]) => verifyFullBookingDestination(...args),
    invalidateFullBookingDestination: (...args: unknown[]) => invalidateFullBookingDestination(...args),
    loadFullBookingDestinationOpsView: (...args: unknown[]) => loadFullBookingDestinationOpsView(...args),
  };
});

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { GET, POST } from './full-booking-destination';

const ORIGIN = 'https://kersivo.test';
const attestations = {
  dnsPointsCorrectly: true,
  httpsWorks: true,
  liveSiteReachable: true,
  correctShopLocation: true,
  bookingFlowReachable: true,
};

function post(body: unknown, headers: Record<string, string> = { Origin: ORIGIN }): APIContext {
  return {
    request: new Request(`${ORIGIN}/api/ops/full-booking-destination`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOperatorAccess.mockResolvedValue({ userId: 'op-1', email: 'ops@kersivo.co.uk' });
});

describe('POST /api/ops/full-booking-destination', () => {
  it('21: a normal customer / shop admin session (not on the OPS allowlist) is refused', async () => {
    requireOperatorAccess.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: 'FORBIDDEN' } }), { status: 403 }),
    );
    const res = await POST(post({ action: 'VERIFY', shopId: 'shop-1', url: 'https://examplebarbers.co.uk/book', attestations }));
    expect(res.status).toBe(403);
    expect(verifyFullBookingDestination).not.toHaveBeenCalled();
  });

  it('21: cross-origin or missing-Origin requests never reach the mutation', async () => {
    for (const headers of [{ Origin: 'https://evil.example' }, {} as Record<string, string>]) {
      const res = await POST(post({ action: 'VERIFY', shopId: 'shop-1', url: 'https://examplebarbers.co.uk/book', attestations }, headers));
      expect(res.status).toBe(403);
    }
    expect(requireOperatorAccess).not.toHaveBeenCalled();
    expect(verifyFullBookingDestination).not.toHaveBeenCalled();
  });

  it('VERIFY requires every OPS attestation', async () => {
    const res = await POST(
      post({ action: 'VERIFY', shopId: 'shop-1', url: 'https://examplebarbers.co.uk/book', attestations: { ...attestations, httpsWorks: false } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('ATTESTATIONS_REQUIRED');
    expect(verifyFullBookingDestination).not.toHaveBeenCalled();
  });

  it('12: VERIFY passes the operator identity and the explicit replace flag', async () => {
    verifyFullBookingDestination.mockResolvedValue({ ok: true, outcome: 'verified', destination: { url: 'x' } });
    const res = await POST(
      post({ action: 'VERIFY', shopId: ' shop-1 ', url: 'https://examplebarbers.co.uk/book', siteVersion: 'v7', attestations }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(verifyFullBookingDestination).toHaveBeenCalledWith({
      shopId: 'shop-1',
      url: 'https://examplebarbers.co.uk/book',
      siteVersion: 'v7',
      replaceExisting: false,
      actor: { userId: 'op-1', email: 'ops@kersivo.co.uk' },
    });
  });

  it.each([
    [{ ok: false, reason: 'INVALID_URL', code: 'HTTPS_REQUIRED' }, 400, 'INVALID_URL'],
    [{ ok: false, reason: 'NOT_FULL' }, 409, 'NOT_FULL_KERSIVO'],
    [{ ok: false, reason: 'PROTECTED_SHOP' }, 409, 'PROTECTED_SHOP'],
    [{ ok: false, reason: 'URL_CHANGE_NOT_CONFIRMED' }, 409, 'URL_CHANGE_NOT_CONFIRMED'],
    [{ ok: false, reason: 'NOT_FOUND' }, 404, 'NOT_FOUND'],
  ])('maps %o to %i', async (result, status, code) => {
    verifyFullBookingDestination.mockResolvedValue(result);
    const res = await POST(post({ action: 'VERIFY', shopId: 'shop-1', url: 'u', attestations }));
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
  });

  it('24: INVALIDATE forwards the reason and operator', async () => {
    invalidateFullBookingDestination.mockResolvedValue({ ok: true, outcome: 'invalidated' });
    const res = await POST(post({ action: 'INVALIDATE', shopId: 'shop-1', reason: 'DNS moved' }));
    expect(res.status).toBe(200);
    expect(invalidateFullBookingDestination).toHaveBeenCalledWith({
      shopId: 'shop-1',
      reason: 'DNS moved',
      actor: { userId: 'op-1', email: 'ops@kersivo.co.uk' },
    });
  });

  it('rejects unknown actions and missing shop ids', async () => {
    expect((await POST(post({ action: 'DELETE', shopId: 'shop-1' }))).status).toBe(400);
    expect((await POST(post({ action: 'VERIFY', attestations }))).status).toBe(400);
  });
});

describe('GET /api/ops/full-booking-destination', () => {
  it('is operator-only', async () => {
    requireOperatorAccess.mockResolvedValue(new Response('{}', { status: 401 }));
    const res = await GET({ request: new Request(`${ORIGIN}/api/ops/full-booking-destination?shopId=shop-1`) } as never);
    expect(res.status).toBe(401);
    expect(loadFullBookingDestinationOpsView).not.toHaveBeenCalled();
  });

  it('returns the record and audit trail for one shop', async () => {
    loadFullBookingDestinationOpsView.mockResolvedValue({ destination: null, events: [] });
    const res = await GET({ request: new Request(`${ORIGIN}/api/ops/full-booking-destination?shopId=shop-1`) } as never);
    expect(res.status).toBe(200);
    expect(loadFullBookingDestinationOpsView).toHaveBeenCalledWith('shop-1');
  });
});
