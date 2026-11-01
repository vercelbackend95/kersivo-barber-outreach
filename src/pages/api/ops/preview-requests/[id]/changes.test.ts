import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireOperatorMutation = vi.fn();
const requireOperatorAccess = vi.fn();
const setHubChangeStatus = vi.fn();
const loadHubChanges = vi.fn();
const findUnique = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/ops/requireOperatorMutation', () => ({
  requireOperatorMutation: (...args: unknown[]) => requireOperatorMutation(...args),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({
  requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args),
  OPS_API_HEADERS: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
}));
vi.mock('@/lib/freePreview/hubPage', () => ({ isAnyHubRouteEnabled: () => true }));
vi.mock('@/lib/freePreview/hubChanges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubChanges')>();
  return {
    ...actual,
    setHubChangeStatus: (...args: unknown[]) => setHubChangeStatus(...args),
    loadHubChanges: (...args: unknown[]) => loadHubChanges(...args),
  };
});
vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: { findUnique: (...args: unknown[]) => findUnique(...args) },
    previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) },
  },
}));

import { GET, POST } from './changes';
import { HUB_OPS_CHANGE_NOTE } from '@/lib/freePreview/hubCopy';

function post(body: unknown) {
  return POST({
    request: new Request('http://localhost/api/ops/preview-requests/req_1/changes', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { id: 'req_1' },
  } as never);
}

beforeEach(() => {
  requireOperatorMutation.mockReset().mockResolvedValue({ email: 'ops@kersivo.co.uk' });
  requireOperatorAccess.mockReset().mockResolvedValue({ email: 'ops@kersivo.co.uk' });
  findUnique.mockReset().mockResolvedValue({
    id: 'req_1',
    anonymisedAt: null,
    includedChangeRounds: 1,
    changeRoundsUsed: 1,
  });
  setHubChangeStatus.mockReset().mockResolvedValue({ id: 'ch_1', status: 'IN_PROGRESS' });
  loadHubChanges.mockReset().mockResolvedValue([{ id: 'ch_1', status: 'SENT' }]);
  eventCreate.mockReset();
});

describe('GET /api/ops/preview-requests/[id]/changes', () => {
  it('lists changes', async () => {
    const response = await GET({
      request: new Request('http://localhost/api/ops/preview-requests/req_1/changes'),
      params: { id: 'req_1' },
    } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });
});

describe('POST /api/ops/preview-requests/[id]/changes', () => {
  it('sets IN_PROGRESS', async () => {
    const response = await post({ changeId: 'ch_1', status: 'IN_PROGRESS' });
    expect(response.status).toBe(200);
    expect(eventCreate).toHaveBeenCalled();
  });

  it('requires a note for NOT_POSSIBLE', async () => {
    const response = await post({ changeId: 'ch_1', status: 'NOT_POSSIBLE' });
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe(HUB_OPS_CHANGE_NOTE);
  });

  it('sets NOT_POSSIBLE with a note', async () => {
    setHubChangeStatus.mockResolvedValueOnce({ id: 'ch_1', status: 'NOT_POSSIBLE' });
    const response = await post({
      changeId: 'ch_1',
      status: 'NOT_POSSIBLE',
      opsNote: 'That page is not in this preview.',
    });
    expect(response.status).toBe(200);
  });

  it('denies without operator auth', async () => {
    requireOperatorMutation.mockResolvedValueOnce(new Response('no', { status: 401 }));
    expect((await post({ changeId: 'ch_1', status: 'DONE' })).status).toBe(401);
  });
});
