import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminContext, loadKersivoAccess, recordAccountLifecycleEvent } = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  loadKersivoAccess: vi.fn(),
  recordAccountLifecycleEvent: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...a: unknown[]) => requireAdminContext(...a),
}));
vi.mock('@/lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...a: unknown[]) => loadKersivoAccess(...a),
}));
vi.mock('@/lib/setup/accountLifecycleAudit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/setup/accountLifecycleAudit')>()),
  recordAccountLifecycleEvent: (...a: unknown[]) => recordAccountLifecycleEvent(...a),
}));

import { POST } from './starter-upgrade-event';

function ctx(body: unknown) {
  return {
    request: new Request('http://localhost/api/admin/analytics/starter-upgrade-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never;
}

describe('POST /api/admin/analytics/starter-upgrade-event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue({ shopId: 'shop-1', userId: 'u1', role: 'OWNER' });
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING' });
  });

  it.each([
    ['viewed', 'STARTER_PAYMENT_SETTINGS_UPGRADE_VIEWED'],
    ['clicked', 'STARTER_PAYMENT_SETTINGS_UPGRADE_CLICKED'],
  ])('persists the Starter upgrade %s event with no personal data', async (event, action) => {
    const res = await POST(ctx({ event, placement: 'barbershop_settings_payments' }));
    expect(res.status).toBe(204);
    expect(recordAccountLifecycleEvent).toHaveBeenCalledWith({
      action,
      shopId: 'shop-1',
      meta: { event: `starter_payment_settings_upgrade_${event}`, placement: 'barbershop_settings_payments' },
    });
    const [recorded] = recordAccountLifecycleEvent.mock.calls[0] as [Record<string, unknown>];
    expect(recorded).not.toHaveProperty('userId');
    expect(recorded).not.toHaveProperty('email');
  });

  it('ignores non-Starter shops and unknown events', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO' });
    expect((await POST(ctx({ event: 'viewed' }))).status).toBe(204);
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING' });
    expect((await POST(ctx({ event: 'purchased' }))).status).toBe(204);
    expect(recordAccountLifecycleEvent).not.toHaveBeenCalled();
  });

  it('is non-blocking when recording fails', async () => {
    loadKersivoAccess.mockRejectedValue(new Error('db down'));
    expect((await POST(ctx({ event: 'clicked' }))).status).toBe(204);
  });

  it('requires an authenticated admin', async () => {
    requireAdminContext.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    expect((await POST(ctx({ event: 'viewed' }))).status).toBe(401);
    expect(recordAccountLifecycleEvent).not.toHaveBeenCalled();
  });
});
