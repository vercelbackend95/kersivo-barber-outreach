import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enforceHubMessageRates = vi.fn();
const resolveHubApiContext = vi.fn();
const requireMessageCapability = vi.fn();
const loadHubMessages = vi.fn();
const assertMessageAttachments = vi.fn();
const createHubMessage = vi.fn();
const maybeNotifyOpsOfHubMessages = vi.fn();
const notifyOwnerOfKersivoMessage = vi.fn();
const sendServerAnalyticsEvent = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubMessageRates: (...args: unknown[]) => enforceHubMessageRates(...args),
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    requireMessageCapability: (...args: unknown[]) => requireMessageCapability(...args),
  };
});
vi.mock('@/lib/freePreview/hubMessages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubMessages')>();
  return {
    ...actual,
    loadHubMessages: (...args: unknown[]) => loadHubMessages(...args),
    assertMessageAttachments: (...args: unknown[]) => assertMessageAttachments(...args),
    createHubMessage: (...args: unknown[]) => createHubMessage(...args),
  };
});
vi.mock('@/lib/freePreview/hubMessagesNotify', () => ({
  maybeNotifyOpsOfHubMessages: (...args: unknown[]) => maybeNotifyOpsOfHubMessages(...args),
  notifyOwnerOfKersivoMessage: (...args: unknown[]) => notifyOwnerOfKersivoMessage(...args),
}));
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: { previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) } },
}));

import { GET, POST } from './messages';

const TOKEN = 'A'.repeat(43);
const origin = 'http://localhost';

function ctx(caps = { canMessage: true }) {
  return {
    token: TOKEN,
    request: {
      id: 'req_1',
      shopName: 'Sharp Cuts',
      publicToken: TOKEN,
      email: 'sam@example.com',
      firstName: 'Sam',
    },
    state: { kind: 'hub', stage: 'expired', capabilities: caps },
    isOperator: false,
    draft: null,
  };
}

function post(body: unknown) {
  return POST({
    request: new Request(`http://localhost/api/preview-hub/${TOKEN}/messages`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { token: TOKEN },
  } as never);
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
  enforceHubMessageRates.mockReset().mockResolvedValue(null);
  requireMessageCapability.mockReset().mockReturnValue(null);
  resolveHubApiContext.mockReset().mockResolvedValue({ ok: true, ctx: ctx() });
  loadHubMessages.mockReset().mockResolvedValue([]);
  assertMessageAttachments.mockReset().mockResolvedValue({ ok: true });
  createHubMessage.mockReset().mockResolvedValue({
    id: 'msg_1',
    author: 'OWNER',
    body: 'Please reopen this preview.',
    createdAt: '2026-10-31T12:00:00.000Z',
    readByOwnerAt: '2026-10-31T12:00:00.000Z',
    readByOpsAt: null,
    attachments: [],
  });
  maybeNotifyOpsOfHubMessages.mockReset().mockResolvedValue('sent');
  notifyOwnerOfKersivoMessage.mockReset().mockResolvedValue('sent');
  sendServerAnalyticsEvent.mockReset();
  eventCreate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/preview-hub/[token]/messages', () => {
  it('lists messages', async () => {
    loadHubMessages.mockResolvedValueOnce([{ id: 'msg_1', body: 'Hello', attachments: [] }]);
    const response = await GET({
      request: new Request(`http://localhost/api/preview-hub/${TOKEN}/messages`),
      params: { token: TOKEN },
    } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).messages[0].id).toBe('msg_1');
  });

  it('404s when the hub flag is off', async () => {
    resolveHubApiContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: 'Not found.' }), { status: 404 }),
    });
    const response = await GET({
      request: new Request(`http://localhost/api/preview-hub/${TOKEN}/messages`),
      params: { token: TOKEN },
    } as never);
    expect(response.status).toBe(404);
  });
});

describe('POST /api/preview-hub/[token]/messages', () => {
  it('sends on the happy path, including expired, and writes hub_message_sent', async () => {
    const response = await post({ body: 'Please reopen this preview.', attachmentIds: ['a1', 'a2'] });
    expect(response.status).toBe(201);
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'hub_message_sent',
          meta: { actor: 'owner', messageId: 'msg_1' },
        }),
      }),
    );
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'hub_message_sent', params: { actor: 'owner' } }),
    );
    expect(maybeNotifyOpsOfHubMessages).toHaveBeenCalled();
  });

  it('rejects validation failures', async () => {
    expect((await post({ body: '' })).status).toBe(400);
    expect(createHubMessage).not.toHaveBeenCalled();
  });

  it('denies when the stage cannot message', async () => {
    requireMessageCapability.mockReturnValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'denied' }), { status: 403 }),
    );
    expect((await post({ body: 'Hello' })).status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    enforceHubMessageRates.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    expect((await post({ body: 'Hello' })).status).toBe(429);
    expect(createHubMessage).not.toHaveBeenCalled();
  });

  it('rejects attachments that do not belong to this request', async () => {
    assertMessageAttachments.mockResolvedValueOnce({ ok: false, error: 'denied' });
    expect((await post({ body: 'Hello', attachmentIds: ['other'] })).status).toBe(400);
  });
});
