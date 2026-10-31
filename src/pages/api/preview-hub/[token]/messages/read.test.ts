import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const markKersivoMessagesReadByOwner = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
  };
});
vi.mock('@/lib/freePreview/hubMessages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubMessages')>();
  return {
    ...actual,
    markKersivoMessagesReadByOwner: (...args: unknown[]) => markKersivoMessagesReadByOwner(...args),
  };
});
vi.mock('@/lib/db/client', () => ({
  prisma: { previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) } },
}));

import { POST } from './read';

const TOKEN = 'A'.repeat(43);

beforeEach(() => {
  resolveHubApiContext.mockReset().mockResolvedValue({
    ok: true,
    ctx: { request: { id: 'req_1' }, isOperator: false, state: { capabilities: { canMessage: true } } },
  });
  markKersivoMessagesReadByOwner.mockReset().mockResolvedValue(2);
  eventCreate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/preview-hub/[token]/messages/read', () => {
  it('marks KERSIVO messages read and writes hub_messages_read', async () => {
    const response = await POST({
      request: new Request(`http://localhost/api/preview-hub/${TOKEN}/messages/read`, {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: '{}',
      }),
      params: { token: TOKEN },
    } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).marked).toBe(2);
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'hub_messages_read' }) }),
    );
  });

  it('404s when the hub context is missing', async () => {
    resolveHubApiContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false }), { status: 404 }),
    });
    const response = await POST({
      request: new Request(`http://localhost/api/preview-hub/${TOKEN}/messages/read`, { method: 'POST' }),
      params: { token: TOKEN },
    } as never);
    expect(response.status).toBe(404);
  });
});
