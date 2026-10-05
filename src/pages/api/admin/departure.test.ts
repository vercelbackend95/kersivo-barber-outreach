import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requireVerifiedEmail = vi.fn();
const requestStarterDeparture = vi.fn();
const loadShopDepartureView = vi.fn();
const recordShopDepartureRequested = vi.fn();
const deliverOutboxEmail = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
  requireVerifiedEmail: (...args: unknown[]) => requireVerifiedEmail(...args),
}));
vi.mock('@/lib/email/outbox', () => ({
  deliverOutboxEmail: (...args: unknown[]) => deliverOutboxEmail(...args),
}));
vi.mock('@/lib/shop/shopDeparture', () => ({
  requestStarterDeparture: (...args: unknown[]) => requestStarterDeparture(...args),
  loadShopDepartureView: (...args: unknown[]) => loadShopDepartureView(...args),
  recordShopDepartureRequested: (...args: unknown[]) => recordShopDepartureRequested(...args),
}));

import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { GET, POST } from './departure';

const ORIGIN = 'https://app.kersivo.test';

function owner(overrides: Record<string, unknown> = {}) {
  return {
    via: 'session',
    role: 'OWNER',
    shopId: 'shop-1',
    userId: 'user-1',
    userEmail: 'owner@example.com',
    emailVerified: true,
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}): APIContext {
  return {
    request: new Request(`${ORIGIN}/api/admin/departure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

function get(): APIContext {
  return { request: new Request(`${ORIGIN}/api/admin/departure`) } as unknown as APIContext;
}

const summary = {
  status: 'WINDING_DOWN',
  origin: 'DIRECT_STARTER_LEAVE',
  requestedAt: '2026-10-05T12:00:00.000Z',
  futureAppointments: 3,
};

describe('/api/admin/departure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue(owner());
    requireVerifiedEmail.mockReturnValue(null);
    requestStarterDeparture.mockResolvedValue({ ok: true, created: true, departure: summary, outboxId: 'out-1' });
    deliverOutboxEmail.mockResolvedValue(undefined);
    recordShopDepartureRequested.mockResolvedValue(undefined);
    loadShopDepartureView.mockResolvedValue({ departure: null, canLeaveDirectly: true, fullKersivoActive: false });
  });

  it('owner with typed confirmation leaves for the session shop only (client shopId ignored)', async () => {
    const res = await POST(post({ confirm: 'LEAVE KERSIVO', shopId: 'other-shop' }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, created: true, departure: summary });
    expect(requestStarterDeparture).toHaveBeenCalledWith({
      shopId: 'shop-1',
      userId: 'user-1',
      email: 'owner@example.com',
    });
    expect(deliverOutboxEmail).toHaveBeenCalledWith('out-1');
    expect(recordShopDepartureRequested).toHaveBeenCalledTimes(1);
  });

  it('replays send no second email and record no second audit event', async () => {
    requestStarterDeparture.mockResolvedValue({ ok: true, created: false, departure: summary, outboxId: null });
    const res = await POST(post({ confirm: 'LEAVE KERSIVO' }) as never);
    expect(res.status).toBe(200);
    expect(deliverOutboxEmail).not.toHaveBeenCalled();
    expect(recordShopDepartureRequested).not.toHaveBeenCalled();
  });

  it.each(['MANAGER', 'BARBER'])('%s cannot leave KERSIVO', async (role) => {
    resolveAdminAccess.mockResolvedValue(owner({ role }));
    const res = await POST(post({ confirm: 'LEAVE KERSIVO' }) as never);
    expect(res.status).toBe(403);
    expect(requestStarterDeparture).not.toHaveBeenCalled();
  });

  it.each(['preview', 'secret', 'legacy-cookie'])('%s access is refused', async (via) => {
    resolveAdminAccess.mockResolvedValue(owner({ via }));
    const res = await POST(post({ confirm: 'LEAVE KERSIVO' }) as never);
    expect(res.status).toBe(401);
    expect(requestStarterDeparture).not.toHaveBeenCalled();
  });

  it('demo shops are refused', async () => {
    resolveAdminAccess.mockResolvedValue(owner({ shopId: DEMO_SHOP_ID }));
    const res = await POST(post({ confirm: 'LEAVE KERSIVO' }) as never);
    expect(res.status).toBe(403);
    expect(requestStarterDeparture).not.toHaveBeenCalled();
  });

  it('signed-out requests are refused', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    expect((await POST(post({ confirm: 'LEAVE KERSIVO' }) as never)).status).toBe(401);
    expect((await GET(get() as never)).status).toBe(401);
  });

  it('cross-origin or missing Origin is refused before any work', async () => {
    const cross = await POST(post({ confirm: 'LEAVE KERSIVO' }, { Origin: 'https://evil.test' }) as never);
    expect(cross.status).toBe(403);
    const ctx = {
      request: new Request(`${ORIGIN}/api/admin/departure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'LEAVE KERSIVO' }),
      }),
    } as unknown as APIContext;
    expect((await POST(ctx as never)).status).toBe(403);
    expect(resolveAdminAccess).not.toHaveBeenCalled();
    expect(requestStarterDeparture).not.toHaveBeenCalled();
  });

  it.each([{}, { confirm: 'leave kersivo' }, { confirm: 'LEAVE' }, { confirm: true }])(
    'requires the exact typed phrase (%o)',
    async (body) => {
      const res = await POST(post(body) as never);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('CONFIRMATION_REQUIRED');
      expect(requestStarterDeparture).not.toHaveBeenCalled();
    },
  );

  it('unverified owner email is refused', async () => {
    requireVerifiedEmail.mockReturnValue(new Response('{}', { status: 403 }));
    expect((await POST(post({ confirm: 'LEAVE KERSIVO' }) as never)).status).toBe(403);
    expect(requestStarterDeparture).not.toHaveBeenCalled();
  });

  it('Full KERSIVO owners are pointed to Full cancellation', async () => {
    requestStarterDeparture.mockResolvedValue({ ok: false, code: 'FULL_KERSIVO_ACTIVE' });
    const res = await POST(post({ confirm: 'LEAVE KERSIVO' }) as never);
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.code).toBe('FULL_KERSIVO_ACTIVE');
    expect(payload.error).toContain('Cancel Full KERSIVO');
  });

  it('GET: owners see the Leave action; staff only see status', async () => {
    const ownerRes = await GET(get() as never);
    expect(await ownerRes.json()).toMatchObject({ canLeaveDirectly: true });

    resolveAdminAccess.mockResolvedValue(owner({ role: 'BARBER' }));
    loadShopDepartureView.mockResolvedValue({
      departure: summary,
      canLeaveDirectly: true,
      fullKersivoActive: false,
    });
    const staffRes = await GET(get() as never);
    expect(await staffRes.json()).toEqual({ departure: summary, canLeaveDirectly: false, fullKersivoActive: false });
  });
});
