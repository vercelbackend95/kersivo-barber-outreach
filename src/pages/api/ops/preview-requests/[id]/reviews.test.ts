import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireOperatorMutation = vi.fn();
const requireOperatorAccess = vi.fn();
const applyHubContentReview = vi.fn();
const dismissHubContentReview = vi.fn();
const loadLatestHubReviews = vi.fn();
const loadHubReviewShopData = vi.fn();
const findUnique = vi.fn();
const eventCreate = vi.fn();

vi.mock('@/lib/ops/requireOperatorMutation', () => ({
  requireOperatorMutation: (...args: unknown[]) => requireOperatorMutation(...args),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({
  requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args),
  OPS_API_HEADERS: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
}));
vi.mock('@/lib/freePreview/hubPage', () => ({ isHubRouteEnabled: () => true }));
vi.mock('@/lib/freePreview/hubReviews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubReviews')>();
  return {
    ...actual,
    applyHubContentReview: (...args: unknown[]) => applyHubContentReview(...args),
    dismissHubContentReview: (...args: unknown[]) => dismissHubContentReview(...args),
    loadLatestHubReviews: (...args: unknown[]) => loadLatestHubReviews(...args),
    loadHubReviewShopData: (...args: unknown[]) => loadHubReviewShopData(...args),
  };
});
vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: { findUnique: (...args: unknown[]) => findUnique(...args) },
    previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) },
  },
}));

import { POST } from './reviews';

function post(body: unknown) {
  return POST({
    request: new Request('http://localhost/api/ops/preview-requests/req_1/reviews', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { id: 'req_1' },
  } as never);
}

beforeEach(() => {
  requireOperatorMutation.mockReset().mockResolvedValue({ email: 'ops@kersivo.co.uk' });
  findUnique.mockReset().mockResolvedValue({ id: 'req_1', anonymisedAt: null, draftShopId: 'shop_1' });
  applyHubContentReview.mockReset().mockResolvedValue({
    ok: true,
    review: { id: 'rev_1', section: 'SERVICES', state: 'APPLIED' },
  });
  dismissHubContentReview.mockReset().mockResolvedValue({
    ok: true,
    review: { id: 'rev_1', section: 'SERVICES', state: 'DISMISSED' },
  });
  eventCreate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/ops/preview-requests/[id]/reviews', () => {
  it('applies a proposal', async () => {
    const response = await post({ action: 'apply', reviewId: 'rev_1' });
    expect(response.status).toBe(200);
    expect(eventCreate).toHaveBeenCalled();
  });

  it('is idempotent when already applied', async () => {
    applyHubContentReview.mockResolvedValueOnce({
      ok: true,
      review: { id: 'rev_1', section: 'SERVICES', state: 'APPLIED' },
    });
    expect((await post({ action: 'apply', reviewId: 'rev_1' })).status).toBe(200);
  });

  it('refuses an incompatible shop', async () => {
    applyHubContentReview.mockResolvedValueOnce({ ok: false, code: 'INCOMPATIBLE' });
    const response = await post({ action: 'apply', reviewId: 'rev_1' });
    expect(response.status).toBe(409);
  });

  it('dismisses with a note', async () => {
    const response = await post({ action: 'dismiss', reviewId: 'rev_1', opsNote: 'Price list is already correct.' });
    expect(response.status).toBe(200);
  });

  it('denies without operator auth', async () => {
    requireOperatorMutation.mockResolvedValueOnce(new Response('no', { status: 401 }));
    expect((await post({ action: 'apply', reviewId: 'rev_1' })).status).toBe(401);
  });
});
