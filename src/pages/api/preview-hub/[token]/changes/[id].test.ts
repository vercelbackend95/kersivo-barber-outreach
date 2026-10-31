import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enforceHubChangesRate = vi.fn();
const resolveHubApiContext = vi.fn();
const requireDraftChangesCapability = vi.fn();
const updateHubChangeDraft = vi.fn();
const deleteHubChangeDraft = vi.fn();
const assertChangeAttachment = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubChangesRate: (...args: unknown[]) => enforceHubChangesRate(...args),
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    requireDraftChangesCapability: (...args: unknown[]) => requireDraftChangesCapability(...args),
  };
});
vi.mock('@/lib/freePreview/hubChanges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubChanges')>();
  return {
    ...actual,
    updateHubChangeDraft: (...args: unknown[]) => updateHubChangeDraft(...args),
    deleteHubChangeDraft: (...args: unknown[]) => deleteHubChangeDraft(...args),
    assertChangeAttachment: (...args: unknown[]) => assertChangeAttachment(...args),
  };
});
vi.mock('@/lib/db/client', () => ({
  prisma: { previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) } },
}));

import { DELETE, PATCH } from './[id]';

const TOKEN = 'A'.repeat(43);

function ctx(caps = { canDraftChanges: true }) {
  return {
    token: TOKEN,
    request: { id: 'req_1' },
    state: { kind: 'hub', stage: 'review', capabilities: caps },
    isOperator: false,
  };
}

function patch(body: unknown) {
  return PATCH({
    request: new Request(`http://localhost/api/preview-hub/${TOKEN}/changes/ch_1`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { token: TOKEN, id: 'ch_1' },
  } as never);
}

function del() {
  return DELETE({
    request: new Request(`http://localhost/api/preview-hub/${TOKEN}/changes/ch_1`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost' },
    }),
    params: { token: TOKEN, id: 'ch_1' },
  } as never);
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
  enforceHubChangesRate.mockReset().mockResolvedValue(null);
  requireDraftChangesCapability.mockReset().mockReturnValue(null);
  resolveHubApiContext.mockReset().mockResolvedValue({ ok: true, ctx: ctx() });
  updateHubChangeDraft.mockReset().mockResolvedValue({ id: 'ch_1', page: 'HOME', status: 'DRAFT' });
  deleteHubChangeDraft.mockReset().mockResolvedValue(true);
  assertChangeAttachment.mockReset().mockResolvedValue({ ok: true });
  eventCreate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('PATCH /api/preview-hub/[token]/changes/[id]', () => {
  it('updates a draft', async () => {
    const response = await patch({ page: 'HOME', body: 'Bigger logo' });
    expect(response.status).toBe(200);
    expect(eventCreate).toHaveBeenCalled();
  });

  it('404s when the hub is off', async () => {
    resolveHubApiContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false }), { status: 404 }),
    });
    expect((await patch({ page: 'HOME', body: 'X' })).status).toBe(404);
  });

  it('denies before Review', async () => {
    requireDraftChangesCapability.mockReturnValueOnce(
      new Response(JSON.stringify({ ok: false }), { status: 403 }),
    );
    expect((await patch({ page: 'HOME', body: 'X' })).status).toBe(403);
  });

  it('rejects empty body', async () => {
    expect((await patch({ page: 'HOME', body: '' })).status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    enforceHubChangesRate.mockResolvedValueOnce(new Response('limited', { status: 429 }));
    expect((await patch({ page: 'HOME', body: 'X' })).status).toBe(429);
  });
});

describe('DELETE /api/preview-hub/[token]/changes/[id]', () => {
  it('deletes a draft', async () => {
    const response = await del();
    expect(response.status).toBe(200);
    expect(eventCreate).toHaveBeenCalled();
  });

  it('404s when the draft is missing', async () => {
    deleteHubChangeDraft.mockResolvedValueOnce(false);
    expect((await del()).status).toBe(404);
  });
});
