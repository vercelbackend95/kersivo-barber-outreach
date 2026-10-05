import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireOperatorMutation = vi.fn();
const transitionQrKitFulfilment = vi.fn();

vi.mock('@/lib/ops/requireOperatorMutation', () => ({
  requireOperatorMutation: (...args: unknown[]) => requireOperatorMutation(...args),
}));

vi.mock('@/lib/qr/qrKitFulfilment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/qr/qrKitFulfilment')>();
  return {
    ...actual,
    transitionQrKitFulfilment: (...args: unknown[]) => transitionQrKitFulfilment(...args),
  };
});

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { POST } from './transition';

function ctx(body: unknown): APIContext {
  return {
    params: { id: 'kit_1' },
    request: new Request('https://kersivo.test/api/ops/qr-kits/kit_1/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://kersivo.test' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOperatorMutation.mockResolvedValue({ userId: 'op1', email: 'ops@kersivo.co.uk', name: 'Op' });
});

describe('POST /api/ops/qr-kits/[id]/transition', () => {
  it('is gated by operator session auth (no secret endpoint)', async () => {
    requireOperatorMutation.mockResolvedValue(new Response('{}', { status: 503 }));
    const res = await POST(ctx({ toStatus: 'VERIFYING' }));
    expect(res.status).toBe(503);
    expect(transitionQrKitFulfilment).not.toHaveBeenCalled();
  });

  it('rejects unknown statuses', async () => {
    const res = await POST(ctx({ toStatus: 'SHIPPED' }));
    expect(res.status).toBe(400);
    expect(transitionQrKitFulfilment).not.toHaveBeenCalled();
  });

  it('maps invalid jumps to 409', async () => {
    transitionQrKitFulfilment.mockResolvedValue({
      ok: false,
      reason: 'INVALID_TRANSITION',
      from: 'REQUESTED',
      to: 'DISPATCHED',
    });
    const res = await POST(ctx({ toStatus: 'DISPATCHED' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('INVALID_TRANSITION');
  });

  it('records the operator as the actor and passes dispatch details', async () => {
    transitionQrKitFulfilment.mockResolvedValue({ ok: true, fulfilment: { id: 'kit_1' }, qrCodes: null });
    const res = await POST(
      ctx({ toStatus: 'DISPATCHED', dispatchCarrier: 'Royal Mail', dispatchReference: 'RM1' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(transitionQrKitFulfilment).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfilmentId: 'kit_1',
        toStatus: 'DISPATCHED',
        actor: { userId: 'op1', email: 'ops@kersivo.co.uk' },
        fields: { dispatchCarrier: 'Royal Mail', dispatchReference: 'RM1' },
      }),
    );
  });
});
