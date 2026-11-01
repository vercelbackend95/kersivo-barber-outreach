import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const requireEditDetailsCapability = vi.fn();
const enforceHubDetailsRate = vi.fn();
const saveBrandColours = vi.fn();
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
vi.mock('@/lib/adminHub/brandColours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/adminHub/brandColours')>();
  return {
    ...actual,
    saveBrandColours: (...args: unknown[]) => saveBrandColours(...args),
  };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));

import { PATCH } from './brand-colours';

const saved = {
  brandPrimaryColour: '#1F6F6B',
  brandSecondaryColour: '#C9A24A',
  brandBackgroundTone: 'DARK',
  brandColoursSource: 'LOGO',
  brandPaletteExtracted: [{ hex: '#1F6F6B', share: 0.4 }],
  brandColoursSentAt: null,
};

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
  saveBrandColours.mockReset().mockResolvedValue(saved);
  sendServerAnalyticsEvent.mockReset();
});
afterEach(() => vi.clearAllMocks());

function patch(body: unknown) {
  return PATCH({
    request: new Request('http://localhost/api/admin-hub/brand-colours', {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
  } as never);
}

describe('PATCH /api/admin-hub/brand-colours', () => {
  it('saves a draft without analytics', async () => {
    const response = await patch({
      brandPrimaryColour: '#1f6f6b',
      brandSecondaryColour: '#c9a24a',
      brandBackgroundTone: 'DARK',
      brandColoursSource: 'LOGO',
      brandPaletteExtracted: [{ hex: '#1f6f6b', share: 0.4 }],
    });
    expect(response.status).toBe(200);
    expect(saveBrandColours).toHaveBeenCalledWith({
      requestId: 'req_1',
      patch: expect.objectContaining({
        brandPrimaryColour: '#1F6F6B',
        brandColoursSource: 'LOGO',
      }),
    });
    expect(saveBrandColours.mock.calls[0][0].patch.send).toBeUndefined();
    expect(sendServerAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('sends colours, writes the event payload and fires hub_brand_colours_sent', async () => {
    saveBrandColours.mockResolvedValueOnce({ ...saved, brandColoursSentAt: '2026-10-31T12:00:00.000Z' });
    const response = await patch({
      brandPrimaryColour: '#1f6f6b',
      send: true,
      brandColoursSource: 'MANUAL',
    });
    expect(response.status).toBe(200);
    expect(saveBrandColours).toHaveBeenCalledWith({
      requestId: 'req_1',
      patch: expect.objectContaining({ send: true, brandColoursSource: 'MANUAL' }),
    });
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'hub_brand_colours_sent' }));
  });

  it('does not send analytics for an operator', async () => {
    resolveHubApiContext.mockResolvedValueOnce({
      ok: true,
      ctx: {
        request: { id: 'req_1' },
        state: { capabilities: { canEditDetails: true } },
        isOperator: true,
      },
    });
    expect((await patch({ send: true, brandColoursSource: 'KERSIVO_CHOOSES' })).status).toBe(200);
    expect(sendServerAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('rejects a bad hex and a bad enum', async () => {
    expect((await patch({ brandPrimaryColour: 'teal' })).status).toBe(400);
    expect((await patch({ brandBackgroundTone: 'NAVY' })).status).toBe(400);
    expect(saveBrandColours).not.toHaveBeenCalled();
  });

  it('denies launch-stage edits', async () => {
    requireEditDetailsCapability.mockReturnValueOnce(new Response('{}', { status: 403 }));
    expect((await patch({ brandPrimaryColour: '#1f6f6b' })).status).toBe(403);
    expect(saveBrandColours).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    enforceHubDetailsRate.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    expect((await patch({ send: true })).status).toBe(429);
  });
});
