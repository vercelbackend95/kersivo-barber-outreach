import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enforceHubChangesRate = vi.fn();
const resolveHubApiContext = vi.fn();
const requireDraftChangesCapability = vi.fn();
const requireSendChangesCapability = vi.fn();
const sendHubChanges = vi.fn();
const sendServerAnalyticsEvent = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubChangesRate: (...args: unknown[]) => enforceHubChangesRate(...args),
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    requireDraftChangesCapability: (...args: unknown[]) => requireDraftChangesCapability(...args),
    requireSendChangesCapability: (...args: unknown[]) => requireSendChangesCapability(...args),
  };
});
vi.mock('@/lib/freePreview/hubChanges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubChanges')>();
  return { ...actual, sendHubChanges: (...args: unknown[]) => sendHubChanges(...args) };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));

import { POST } from './send';
import { HUB_ROUND_USED } from '@/lib/freePreview/hubCopy';

const TOKEN = 'A'.repeat(43);

function ctx(caps = { canDraftChanges: true, canSendChanges: true }) {
  return {
    request: { id: 'req_1' },
    state: { capabilities: caps },
    isOperator: false,
  };
}

function post() {
  return POST({
    request: new Request(`http://localhost/api/preview-hub/${TOKEN}/changes/send`, {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: '{}',
    }),
    params: { token: TOKEN },
  } as never);
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
  enforceHubChangesRate.mockReset().mockResolvedValue(null);
  requireDraftChangesCapability.mockReset().mockReturnValue(null);
  requireSendChangesCapability.mockReset().mockReturnValue(null);
  resolveHubApiContext.mockReset().mockResolvedValue({ ok: true, ctx: ctx() });
  sendHubChanges.mockReset().mockResolvedValue({ ok: true, round: 1, items: [] });
  sendServerAnalyticsEvent.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/preview-hub/[token]/changes/send', () => {
  it('sends drafts', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'hub_changes_sent' }));
  });

  it('blocks a second send with the round-used copy', async () => {
    requireSendChangesCapability.mockReturnValueOnce(
      new Response(JSON.stringify({ ok: false, error: HUB_ROUND_USED }), { status: 403 }),
    );
    const response = await post();
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe(HUB_ROUND_USED);
  });
});
