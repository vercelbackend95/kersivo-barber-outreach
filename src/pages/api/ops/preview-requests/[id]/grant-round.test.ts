import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireOperatorMutation = vi.fn();
const grantHubChangeRound = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/ops/requireOperatorMutation', () => ({
  requireOperatorMutation: (...args: unknown[]) => requireOperatorMutation(...args),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({
  OPS_API_HEADERS: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
}));
vi.mock('@/lib/freePreview/hubPage', () => ({ isHubRouteEnabled: () => true }));
vi.mock('@/lib/freePreview/hubChanges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubChanges')>();
  return { ...actual, grantHubChangeRound: (...args: unknown[]) => grantHubChangeRound(...args) };
});
vi.mock('@/lib/db/client', () => ({
  prisma: { previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) } },
}));

import { POST } from './grant-round';

beforeEach(() => {
  requireOperatorMutation.mockReset().mockResolvedValue({ email: 'ops@kersivo.co.uk' });
  grantHubChangeRound.mockReset().mockResolvedValue({ includedChangeRounds: 2, changeRoundsUsed: 1 });
  eventCreate.mockReset();
});

describe('POST /api/ops/preview-requests/[id]/grant-round', () => {
  it('increments includedChangeRounds', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/ops/preview-requests/req_1/grant-round', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: '{}',
      }),
      params: { id: 'req_1' },
    } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).includedChangeRounds).toBe(2);
  });
});
