import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const { reconcile, processDue, captureOpsException } = vi.hoisted(() => ({
  reconcile: vi.fn(),
  processDue: vi.fn(),
  captureOpsException: vi.fn(),
}));

vi.mock('@/lib/ops/cronAuth', () => ({ authorizeCronRequest: () => null }));
vi.mock('@/lib/ops/sentry', () => ({ captureOpsException }));
vi.mock('@/lib/email/internalSignupNotifications', () => ({
  reconcileInternalSignupNotifications: (...a: unknown[]) => reconcile(...a),
}));
vi.mock('@/lib/email/outbox', () => ({
  processDueEmailOutbox: (...a: unknown[]) => processDue(...a),
}));

import { GET } from './email-outbox';

async function run() {
  const res = await GET({ request: new Request('http://localhost/api/cron/email-outbox') } as unknown as APIContext);
  return { status: res.status, body: await res.json() };
}

const drained = { scanned: 1, sent: 1, queued: 0, failed: 0, skipped: 0 };

describe('/api/cron/email-outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processDue.mockResolvedValue(drained);
  });

  it('reconciles internal notifications before draining, so recovered rows go out in the same run', async () => {
    const order: string[] = [];
    reconcile.mockImplementation(async () => {
      order.push('reconcile');
      return { enabled: true, registrations: { candidates: 1, enqueued: 1, errors: 0 }, starterActivations: { candidates: 0, enqueued: 0, errors: 0 } };
    });
    processDue.mockImplementation(async () => {
      order.push('drain');
      return drained;
    });

    const res = await run();

    expect(res.status).toBe(200);
    expect(order).toEqual(['reconcile', 'drain']);
    expect(res.body).toMatchObject({ ok: true, sent: 1, reconcile: { enabled: true } });
  });

  it('a reconciliation failure is reported and never blocks the outbox drain', async () => {
    reconcile.mockRejectedValue(new Error('db blip'));

    const res = await run();

    expect(res.status).toBe(200);
    expect(processDue).toHaveBeenCalledTimes(1);
    expect(res.body.reconcile).toEqual({ error: 'reconcile_failed' });
    expect(captureOpsException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ route: 'cron.email-outbox.reconcile', opsAlert: true }),
    );
  });
});
