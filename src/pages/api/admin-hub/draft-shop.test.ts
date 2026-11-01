import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubContext = vi.fn();
const ensureHubDraftShop = vi.fn();

vi.mock('@/lib/freePreview/hubPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubPage')>();
  return { ...actual, resolveHubContext: (...args: unknown[]) => resolveHubContext(...args) };
});
vi.mock('@/lib/freePreview/ensureHubDraftShop', () => ({
  ensureHubDraftShop: (...args: unknown[]) => ensureHubDraftShop(...args),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({ resolveOperatorAccess: async () => ({ ok: false }) }));
vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({ enforceIpRateLimit: async () => null }));

import { POST } from './draft-shop';

function call(origin = 'http://localhost') {
  const request = new Request('http://localhost/api/admin-hub/draft-shop', {
    method: 'POST',
    headers: { cookie: 'ks_hub=v1.req_1.1.x', origin, 'content-type': 'application/json' },
  });
  return POST({ request, params: {}, url: new URL(request.url), locals: {} } as never);
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('ADMIN_HUB_ENABLED', 'true');
  resolveHubContext.mockReset().mockResolvedValue({
    token: '',
    source: 'cookie',
    request: { id: 'req_1' },
    state: { kind: 'hub', stage: 'review', capabilities: {} },
    isOperator: false,
    draft: null,
  });
  ensureHubDraftShop.mockReset().mockResolvedValue({ ok: true, shopId: 'shop_draft', created: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/admin-hub/draft-shop', () => {
  it('is 404 with the flag off', async () => {
    vi.stubEnv('ADMIN_HUB_ENABLED', 'false');
    const response = await call();
    expect(response.status).toBe(404);
    expect(ensureHubDraftShop).not.toHaveBeenCalled();
  });

  it('refuses a cross-origin mutation', async () => {
    const response = await call('https://evil.example');
    expect(response.status).toBe(403);
    expect(ensureHubDraftShop).not.toHaveBeenCalled();
  });

  it('returns { shopId } for a review-stage hub session', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ shopId: 'shop_draft' });
    expect(ensureHubDraftShop).toHaveBeenCalledWith('req_1');
  });

  it('refuses launch-stage sessions', async () => {
    resolveHubContext.mockResolvedValue({
      token: '',
      source: 'cookie',
      request: { id: 'req_1' },
      state: { kind: 'hub', stage: 'launch', capabilities: {} },
      isOperator: false,
      draft: null,
    });
    const response = await call();
    expect(response.status).toBe(403);
    expect(ensureHubDraftShop).not.toHaveBeenCalled();
  });
});
