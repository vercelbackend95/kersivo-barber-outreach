import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireOperatorMutation = vi.fn();
const unlockBrandColours = vi.fn();

vi.mock('@/lib/ops/requireOperatorMutation', () => ({
  requireOperatorMutation: (...args: unknown[]) => requireOperatorMutation(...args),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({
  OPS_API_HEADERS: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
}));
vi.mock('@/lib/freePreview/hubPage', () => ({ isAnyHubRouteEnabled: () => true }));
vi.mock('@/lib/adminHub/brandLock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/adminHub/brandLock')>();
  return { ...actual, unlockBrandColours: (...args: unknown[]) => unlockBrandColours(...args) };
});

import { POST } from './unlock-brand';

beforeEach(() => {
  requireOperatorMutation.mockReset().mockResolvedValue({ email: 'ops@kersivo.co.uk' });
  unlockBrandColours.mockReset().mockResolvedValue({
    ok: true,
    wasLocked: true,
    submittedAt: '2026-11-02T12:00:00.000Z',
  });
});

function post(id: string, headers: Record<string, string> = {}) {
  return POST({
    request: new Request(`http://localhost/api/ops/preview-requests/${id}/unlock-brand`, {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json', ...headers },
      body: '{}',
    }),
    params: { id },
  } as never);
}

describe('POST /api/ops/preview-requests/[id]/unlock-brand', () => {
  it('unlocks for a KERSIVO operator', async () => {
    const response = await post('req_1');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      wasLocked: true,
      submittedAt: '2026-11-02T12:00:00.000Z',
    });
    expect(unlockBrandColours).toHaveBeenCalledWith({
      requestId: 'req_1',
      actorEmail: 'ops@kersivo.co.uk',
    });
  });

  it('rejects non-KERSIVO users', async () => {
    requireOperatorMutation.mockResolvedValueOnce(new Response('no', { status: 401 }));
    const response = await post('req_1');
    expect(response.status).toBe(401);
    expect(unlockBrandColours).not.toHaveBeenCalled();
  });
});
