import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enforceHubChangesRate = vi.fn();
const resolveHubApiContext = vi.fn();
const requireDraftChangesCapability = vi.fn();
const createHubChangeDraft = vi.fn();
const loadHubChanges = vi.fn();
const assertChangeAttachment = vi.fn();
const sendServerAnalyticsEvent = vi.fn();
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
    createHubChangeDraft: (...args: unknown[]) => createHubChangeDraft(...args),
    loadHubChanges: (...args: unknown[]) => loadHubChanges(...args),
    assertChangeAttachment: (...args: unknown[]) => assertChangeAttachment(...args),
  };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: { previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) } },
}));

import { GET, POST } from './changes';

const TOKEN = 'A'.repeat(43);

function ctx(caps = { canDraftChanges: true, canSendChanges: true }) {
  return {
    token: TOKEN,
    request: { id: 'req_1', includedChangeRounds: 1, changeRoundsUsed: 0 },
    state: { kind: 'hub', stage: 'review', capabilities: caps },
    isOperator: false,
  };
}

function post(body: unknown) {
  return POST({
    request: new Request(`http://localhost/api/preview-hub/${TOKEN}/changes`, {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { token: TOKEN },
  } as never);
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
  enforceHubChangesRate.mockReset().mockResolvedValue(null);
  requireDraftChangesCapability.mockReset().mockReturnValue(null);
  resolveHubApiContext.mockReset().mockResolvedValue({ ok: true, ctx: ctx() });
  createHubChangeDraft.mockReset().mockResolvedValue({ id: 'ch_1', page: 'HOME', status: 'DRAFT' });
  assertChangeAttachment.mockReset().mockResolvedValue({ ok: true });
  loadHubChanges.mockReset().mockResolvedValue([]);
  sendServerAnalyticsEvent.mockReset();
  eventCreate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/preview-hub/[token]/changes', () => {
  it('creates a draft', async () => {
    const response = await post({ page: 'HOME', body: 'Bigger logo' });
    expect(response.status).toBe(201);
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'hub_change_drafted' }));
  });

  it('404s when the hub is off', async () => {
    resolveHubApiContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false }), { status: 404 }),
    });
    expect((await post({ page: 'HOME', body: 'X' })).status).toBe(404);
  });

  it('denies before Review', async () => {
    requireDraftChangesCapability.mockReturnValueOnce(new Response(JSON.stringify({ ok: false }), { status: 403 }));
    expect((await post({ page: 'HOME', body: 'X' })).status).toBe(403);
  });

  it('rejects empty body', async () => {
    expect((await post({ page: 'HOME', body: '' })).status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    enforceHubChangesRate.mockResolvedValueOnce(new Response('limited', { status: 429 }));
    expect((await post({ page: 'HOME', body: 'X' })).status).toBe(429);
  });
});

describe('GET /api/preview-hub/[token]/changes', () => {
  it('lists changes', async () => {
    const response = await GET({
      request: new Request(`http://localhost/api/preview-hub/${TOKEN}/changes`),
      params: { token: TOKEN },
    } as never);
    expect(response.status).toBe(200);
  });
});
