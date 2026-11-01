import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireOperatorAccess = vi.fn();
const requireOperatorMutation = vi.fn();
const isAnyHubRouteEnabled = vi.fn();
const findUnique = vi.fn();
const eventCreate = vi.fn();
const loadHubMessages = vi.fn();
const markOwnerMessagesReadByOps = vi.fn();
const assertMessageAttachments = vi.fn();
const createHubMessage = vi.fn();
const notifyOwnerOfKersivoMessage = vi.fn();

vi.mock('@/lib/ops/operatorAuth', () => ({
  OPS_API_HEADERS: { 'Content-Type': 'application/json' },
  requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args),
}));
vi.mock('@/lib/ops/requireOperatorMutation', () => ({
  requireOperatorMutation: (...args: unknown[]) => requireOperatorMutation(...args),
}));
vi.mock('@/lib/freePreview/hubPage', () => ({
  isAnyHubRouteEnabled: (...args: unknown[]) => isAnyHubRouteEnabled(...args),
}));
vi.mock('@/lib/freePreview/hubMessages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubMessages')>();
  return {
    ...actual,
    loadHubMessages: (...args: unknown[]) => loadHubMessages(...args),
    markOwnerMessagesReadByOps: (...args: unknown[]) => markOwnerMessagesReadByOps(...args),
    assertMessageAttachments: (...args: unknown[]) => assertMessageAttachments(...args),
    createHubMessage: (...args: unknown[]) => createHubMessage(...args),
  };
});
vi.mock('@/lib/freePreview/hubMessagesNotify', () => ({
  notifyOwnerOfKersivoMessage: (...args: unknown[]) => notifyOwnerOfKersivoMessage(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: { findUnique: (...args: unknown[]) => findUnique(...args) },
    previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) },
  },
}));

import { GET, POST } from './messages';

const access = { userId: 'op_1', email: 'ops@kersivo.co.uk' };

beforeEach(() => {
  isAnyHubRouteEnabled.mockReset().mockReturnValue(true);
  requireOperatorAccess.mockReset().mockResolvedValue(access);
  requireOperatorMutation.mockReset().mockResolvedValue(access);
  findUnique.mockReset().mockResolvedValue({
    id: 'req_1',
    anonymisedAt: null,
    email: 'sam@example.com',
    firstName: 'Sam',
    shopName: 'Sharp Cuts',
    publicToken: 'A'.repeat(43),
  });
  loadHubMessages.mockReset().mockResolvedValue([]);
  markOwnerMessagesReadByOps.mockReset().mockResolvedValue(1);
  assertMessageAttachments.mockReset().mockResolvedValue({ ok: true });
  createHubMessage.mockReset().mockResolvedValue({
    id: 'msg_2',
    author: 'KERSIVO',
    body: 'We can reopen it.',
    attachments: [],
  });
  notifyOwnerOfKersivoMessage.mockReset().mockResolvedValue('sent');
  eventCreate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/ops/preview-requests/[id]/messages', () => {
  it('lists the thread and marks owner messages read', async () => {
    loadHubMessages.mockResolvedValueOnce([{ id: 'msg_1' }]);
    const response = await GET({
      request: new Request('http://localhost/api/ops/preview-requests/req_1/messages'),
      params: { id: 'req_1' },
    } as never);
    expect(response.status).toBe(200);
    expect(markOwnerMessagesReadByOps).toHaveBeenCalled();
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ops_hub_messages_read' }) }),
    );
  });

  it('denies when operator auth fails', async () => {
    requireOperatorAccess.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    expect(
      (
        await GET({
          request: new Request('http://localhost/api/ops/preview-requests/req_1/messages'),
          params: { id: 'req_1' },
        } as never)
      ).status,
    ).toBe(401);
  });

  it('404s when the hub is off', async () => {
    isAnyHubRouteEnabled.mockReturnValueOnce(false);
    expect(
      (
        await GET({
          request: new Request('http://localhost/api/ops/preview-requests/req_1/messages'),
          params: { id: 'req_1' },
        } as never)
      ).status,
    ).toBe(404);
  });
});

describe('POST /api/ops/preview-requests/[id]/messages', () => {
  function post(body: unknown) {
    return POST({
      request: new Request('http://localhost/api/ops/preview-requests/req_1/messages', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      params: { id: 'req_1' },
    } as never);
  }

  it('sends a KERSIVO reply and emails the owner', async () => {
    const response = await post({ body: 'We can reopen it.' });
    expect(response.status).toBe(201);
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ops_hub_message_sent' }) }),
    );
    expect(notifyOwnerOfKersivoMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'sam@example.com', shopName: 'Sharp Cuts' }),
    );
  });

  it('rejects invalid bodies', async () => {
    expect((await post({ body: '' })).status).toBe(400);
  });
});
