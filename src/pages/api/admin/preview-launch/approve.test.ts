import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireLaunchOwner = vi.fn();
const approveLaunch = vi.fn();

vi.mock('@/lib/freePreview/hubLaunchApi', () => ({
  launchJson: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  requireLaunchOwner: (...args: unknown[]) => requireLaunchOwner(...args),
}));
vi.mock('@/lib/freePreview/hubLaunch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubLaunch')>();
  return { ...actual, approveLaunch: (...args: unknown[]) => approveLaunch(...args) };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => null,
}));

import { POST } from './approve';

beforeEach(() => {
  requireLaunchOwner.mockReset().mockResolvedValue({ shopId: 'shop_1', previewRequestId: 'req_1' });
  approveLaunch.mockReset().mockResolvedValue({ ok: true, state: { launchApprovedAt: '2026-10-31' } });
});

function post(body: unknown) {
  return POST({
    request: new Request('http://localhost/api/admin/preview-launch/approve', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never);
}

describe('POST /api/admin/preview-launch/approve', () => {
  it('approves when both confirmations are true', async () => {
    const response = await post({ contentRightsConfirmed: true, informationAccuracyConfirmed: true });
    expect(response.status).toBe(200);
    expect(approveLaunch).toHaveBeenCalled();
  });

  it('rejects missing confirmations', async () => {
    const response = await post({ contentRightsConfirmed: false, informationAccuracyConfirmed: true });
    expect(response.status).toBe(400);
    expect(approveLaunch).not.toHaveBeenCalled();
  });

  it('rejects when business details are incomplete', async () => {
    approveLaunch.mockResolvedValueOnce({ ok: false, code: 'BUSINESS_INCOMPLETE' });
    const response = await post({ contentRightsConfirmed: true, informationAccuracyConfirmed: true });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('business details');
  });
});
