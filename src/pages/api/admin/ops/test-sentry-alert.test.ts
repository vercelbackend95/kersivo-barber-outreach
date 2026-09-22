import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminContext = vi.fn();
const captureOpsMessage = vi.fn();
const notifyOps = vi.fn();
const notifyOpsDurable = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/ops/sentry', () => ({
  captureOpsMessage: (...args: unknown[]) => captureOpsMessage(...args),
}));

vi.mock('@/lib/ops/alertSink', () => ({
  notifyOps: (...args: unknown[]) => notifyOps(...args),
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
}));

import { POST } from './test-sentry-alert';

function makeContext(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/ops/test-sentry-alert', {
      method: 'POST',
    }),
  } as unknown as APIContext;
}

function accessFor(role: 'OWNER' | 'MANAGER' | 'BARBER') {
  return {
    shopId: 'shop-1',
    userId: 'user-1',
    userEmail: 'actor@example.com',
    role,
    via: 'session' as const,
    permissions: [],
    memberId: 'member-1',
    barberId: null,
    userName: 'Actor',
    userImage: null,
    emailVerified: true,
  };
}

describe('POST /api/admin/ops/test-sentry-alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminContext.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );

    const res = await POST(makeContext());
    expect(res.status).toBe(401);
    expect(captureOpsMessage).not.toHaveBeenCalled();
    expect(notifyOps).not.toHaveBeenCalled();
    expect(notifyOpsDurable).not.toHaveBeenCalled();
  });

  it('returns 403 for MANAGER', async () => {
    requireAdminContext.mockResolvedValue(accessFor('MANAGER'));

    const res = await POST(makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
    expect(captureOpsMessage).not.toHaveBeenCalled();
    expect(notifyOps).not.toHaveBeenCalled();
  });

  it('returns 403 for BARBER', async () => {
    requireAdminContext.mockResolvedValue(accessFor('BARBER'));

    const res = await POST(makeContext());
    expect(res.status).toBe(403);
    expect(captureOpsMessage).not.toHaveBeenCalled();
    expect(notifyOps).not.toHaveBeenCalled();
  });

  it('OWNER calls captureOpsMessage once with fixed safe payload only', async () => {
    requireAdminContext.mockResolvedValue(accessFor('OWNER'));

    const res = await POST(makeContext());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(captureOpsMessage).toHaveBeenCalledTimes(1);
    expect(captureOpsMessage).toHaveBeenCalledWith('KERSIVO ops alert routing test', {
      level: 'warning',
      route: 'ops.sentryAlertRoutingTest',
      tags: {
        testEvent: 'true',
      },
    });

    const [, context] = captureOpsMessage.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(context).not.toHaveProperty('shopId');
    expect(JSON.stringify(context)).not.toMatch(/shop-1|user-1|actor@example|Actor|member-1/i);
    expect(notifyOps).not.toHaveBeenCalled();
    expect(notifyOpsDurable).not.toHaveBeenCalled();
  });
});
