import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveOperatorAccess, checkDurableRateLimit, runShopHealth } = vi.hoisted(() => ({
  resolveOperatorAccess: vi.fn(),
  checkDurableRateLimit: vi.fn(),
  runShopHealth: vi.fn(),
}));

vi.mock('@/lib/ops/operatorAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/operatorAuth')>();
  return {
    ...actual,
    resolveOperatorAccess,
    requireOperatorAccess: async () => {
      const result = await resolveOperatorAccess();
      return result.ok ? result.access : actual.operatorAuthFailureResponse(result);
    },
  };
});
vi.mock('@/lib/rate-limit/durableRateLimit', () => ({ checkDurableRateLimit }));
vi.mock('@/lib/ops/shopHealth/run', () => ({ runShopHealth }));
vi.mock('@/lib/ops/shopHealth/context', () => ({ ShopNotFoundError: class ShopNotFoundError extends Error {} }));
vi.mock('@/lib/ops/opsLog', () => ({ opsLogError: vi.fn() }));

import { ShopNotFoundError } from '@/lib/ops/shopHealth/context';
import { POST } from './run';

const ORIGIN = 'https://kersivo.co.uk';

function post(shopId: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return POST({
    request: new Request(`${ORIGIN}/api/ops/shops/${shopId}/health/run`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    params: { shopId },
  } as never) as Promise<Response>;
}

const runResult = {
  runId: 'run_1',
  shopId: 'shop_1',
  trigger: 'MANUAL',
  mode: 'LIVE',
  overall: 'RED',
  readiness: { ready: 10, total: 12 },
  failing: [{ id: 'booking.services', area: 'booking', title: 'Bookable services', severity: 'critical', status: 'fail', message: 'No active services.', fix: 'Add a service.' }],
  warnings: [],
  results: [],
  startedAt: new Date('2026-11-05T10:00:00Z'),
  durationMs: 1234,
  previousOverall: 'GREEN',
  alert: 'none',
};

beforeEach(() => {
  resolveOperatorAccess.mockReset().mockResolvedValue({ ok: true, access: { email: 'ops@kersivo.co.uk', userId: 'u1' } });
  checkDurableRateLimit.mockReset().mockResolvedValue({ ok: true });
  runShopHealth.mockReset().mockResolvedValue(runResult);
});

describe('POST /api/ops/shops/[shopId]/health/run', () => {
  it('401s when signed out and runs nothing', async () => {
    resolveOperatorAccess.mockResolvedValueOnce({ ok: false, status: 401, code: 'UNAUTHENTICATED' });
    expect((await post('shop_1')).status).toBe(401);
    expect(runShopHealth).not.toHaveBeenCalled();
    expect(checkDurableRateLimit).not.toHaveBeenCalled();
  });

  it('403s for a signed-in non-operator', async () => {
    resolveOperatorAccess.mockResolvedValueOnce({ ok: false, status: 403, code: 'FORBIDDEN' });
    expect((await post('shop_1')).status).toBe(403);
    expect(runShopHealth).not.toHaveBeenCalled();
  });

  it('403s a cross-origin request before checking the session', async () => {
    expect((await post('shop_1', {}, { origin: 'https://evil.example' })).status).toBe(403);
    expect(resolveOperatorAccess).not.toHaveBeenCalled();
  });

  it('runs a MANUAL run with probes and returns it', async () => {
    const response = await post('shop_1');
    expect(response.status).toBe(200);
    expect(runShopHealth).toHaveBeenCalledWith('shop_1', { trigger: 'MANUAL', probes: true });
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.run).toMatchObject({
      runId: 'run_1',
      overall: 'RED',
      readiness: { ready: 10, total: 12 },
      failing: [{ id: 'booking.services', title: 'Bookable services', message: 'No active services.', fix: 'Add a service.' }],
      startedAt: '2026-11-05T10:00:00.000Z',
    });
    expect(checkDurableRateLimit).toHaveBeenCalledWith({ key: 'shop:shop_1', action: 'ops_shop_health_run', limit: 1, windowMs: 60_000 });
  });

  it('the launch guard runs a LAUNCH run in LIVE mode on its own bucket', async () => {
    await post('shop_1', { launch: true });
    expect(runShopHealth).toHaveBeenCalledWith('shop_1', { trigger: 'LAUNCH', probes: true, mode: 'LIVE' });
    expect(checkDurableRateLimit).toHaveBeenCalledWith(expect.objectContaining({ action: 'ops_shop_health_launch', limit: 3 }));
  });

  it('429s with Retry-After when the shop was run in the last minute', async () => {
    checkDurableRateLimit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 42 });
    const response = await post('shop_1');
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(runShopHealth).not.toHaveBeenCalled();
  });

  it('400s on unknown body fields', async () => {
    expect((await post('shop_1', { mode: 'PRELAUNCH' })).status).toBe(400);
  });

  it('404s for a missing shop', async () => {
    runShopHealth.mockRejectedValueOnce(new ShopNotFoundError('missing'));
    expect((await post('nope')).status).toBe(404);
  });

  it('500s when the run itself fails', async () => {
    runShopHealth.mockRejectedValueOnce(new Error('db down'));
    const response = await post('shop_1');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: { code: 'RUN_FAILED' } });
  });
});
