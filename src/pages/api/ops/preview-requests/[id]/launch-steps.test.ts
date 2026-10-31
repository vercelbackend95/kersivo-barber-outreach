import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireOperatorMutation = vi.fn();
const setOpsLaunchStep = vi.fn();

vi.mock('@/lib/ops/requireOperatorMutation', () => ({
  requireOperatorMutation: (...args: unknown[]) => requireOperatorMutation(...args),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({
  OPS_API_HEADERS: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
}));
vi.mock('@/lib/freePreview/hubPage', () => ({ isHubRouteEnabled: () => true }));
vi.mock('@/lib/freePreview/hubLaunch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubLaunch')>();
  return { ...actual, setOpsLaunchStep: (...args: unknown[]) => setOpsLaunchStep(...args) };
});

import { POST } from './launch-steps';

beforeEach(() => {
  requireOperatorMutation.mockReset().mockResolvedValue({ email: 'ops@kersivo.co.uk' });
  setOpsLaunchStep.mockReset().mockResolvedValue({ ok: true, liveAt: new Date('2026-10-31T12:00:00Z') });
});

function post(id: string, body: unknown) {
  return POST({
    request: new Request(`http://localhost/api/ops/preview-requests/${id}/launch-steps`, {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { id },
  } as never);
}

describe('POST /api/ops/preview-requests/[id]/launch-steps', () => {
  it('marks live after confirmation', async () => {
    const response = await post('req_1', { step: 'live', confirm: true });
    expect(response.status).toBe(200);
    expect(setOpsLaunchStep).toHaveBeenCalledWith(
      expect.objectContaining({ previewRequestId: 'req_1', step: 'live', actorEmail: 'ops@kersivo.co.uk' }),
    );
  });

  it('rejects without confirm', async () => {
    const response = await post('req_1', { step: 'live' });
    expect(response.status).toBe(400);
    expect(setOpsLaunchStep).not.toHaveBeenCalled();
  });

  it('forwards auth denial', async () => {
    requireOperatorMutation.mockResolvedValueOnce(new Response('no', { status: 401 }));
    const response = await post('req_1', { step: 'domain', confirm: true });
    expect(response.status).toBe(401);
  });
});
