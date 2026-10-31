import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const requireEditDetailsCapability = vi.fn();
const enforceHubDetailsRate = vi.fn();
const saveHubDetails = vi.fn();
const sendServerAnalyticsEvent = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    requireEditDetailsCapability: (...args: unknown[]) => requireEditDetailsCapability(...args),
    enforceHubDetailsRate: (...args: unknown[]) => enforceHubDetailsRate(...args),
  };
});
vi.mock('@/lib/freePreview/hubDetails', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubDetails')>();
  return {
    ...actual,
    saveHubDetails: (...args: unknown[]) => saveHubDetails(...args),
  };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));

import { PATCH } from './details';

const TOKEN = 'A'.repeat(43);

beforeEach(() => {
  resolveHubApiContext.mockReset().mockResolvedValue({
    ok: true,
    ctx: {
      request: { id: 'req_1' },
      state: { capabilities: { canEditDetails: true } },
      isOperator: false,
    },
  });
  requireEditDetailsCapability.mockReset().mockReturnValue(null);
  enforceHubDetailsRate.mockReset().mockResolvedValue(null);
  saveHubDetails.mockReset().mockResolvedValue({
    brandPrimaryColour: '#D72638',
    brandSecondaryColour: null,
    styleNotes: 'warm wood',
    aboutText: null,
  });
  sendServerAnalyticsEvent.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('PATCH /api/preview-hub/[token]/details', () => {
  it('saves valid brand colours', async () => {
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/details`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ brandPrimaryColour: '#d72638', styleNotes: 'warm wood' }),
    });
    const response = await PATCH({ request, params: { token: TOKEN } } as never);
    expect(response.status).toBe(200);
    expect(saveHubDetails).toHaveBeenCalledWith({
      requestId: 'req_1',
      patch: expect.objectContaining({ brandPrimaryColour: '#D72638', styleNotes: 'warm wood' }),
    });
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'hub_details_saved' }));
  });

  it('rejects a bad hex', async () => {
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/details`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ brandPrimaryColour: 'red' }),
    });
    expect((await PATCH({ request, params: { token: TOKEN } } as never)).status).toBe(400);
    expect(saveHubDetails).not.toHaveBeenCalled();
  });

  it('denies launch-stage edits', async () => {
    requireEditDetailsCapability.mockReturnValueOnce(new Response('{}', { status: 403 }));
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/details`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ aboutText: 'hi' }),
    });
    expect((await PATCH({ request, params: { token: TOKEN } } as never)).status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    enforceHubDetailsRate.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    const request = new Request(`http://localhost/api/preview-hub/${TOKEN}/details`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ aboutText: 'hi' }),
    });
    expect((await PATCH({ request, params: { token: TOKEN } } as never)).status).toBe(429);
  });
});
