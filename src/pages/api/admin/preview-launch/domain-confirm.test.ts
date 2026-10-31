import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireLaunchOwner = vi.fn();
const confirmLaunchDomain = vi.fn();

vi.mock('@/lib/freePreview/hubLaunchApi', () => ({
  launchJson: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  requireLaunchOwner: (...args: unknown[]) => requireLaunchOwner(...args),
}));
vi.mock('@/lib/freePreview/hubLaunch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubLaunch')>();
  return { ...actual, confirmLaunchDomain: (...args: unknown[]) => confirmLaunchDomain(...args) };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => null,
}));

import { POST } from './domain-confirm';

beforeEach(() => {
  requireLaunchOwner.mockReset().mockResolvedValue({ shopId: 'shop_1', previewRequestId: 'req_1' });
  confirmLaunchDomain.mockReset().mockResolvedValue({ domain: { confirmed: true } });
});

describe('POST /api/admin/preview-launch/domain-confirm', () => {
  it('records owner confirmation', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/admin/preview-launch/domain-confirm', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      }),
    } as never);
    expect(response.status).toBe(200);
    expect(confirmLaunchDomain).toHaveBeenCalled();
  });
});
