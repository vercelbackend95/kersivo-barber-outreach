import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enforceHubReviewsRate = vi.fn();
const resolveHubApiContext = vi.fn();
const requireReviewCapability = vi.fn();
const createHubContentReview = vi.fn();
const loadLatestHubReviews = vi.fn();
const loadHubReviewShopData = vi.fn();
const assertTeamPhotoAsset = vi.fn();
const sendServerAnalyticsEvent = vi.fn();
const eventCreate = vi.fn();
const findUnique = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubReviewsRate: (...args: unknown[]) => enforceHubReviewsRate(...args),
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
    requireReviewCapability: (...args: unknown[]) => requireReviewCapability(...args),
  };
});
vi.mock('@/lib/freePreview/hubReviews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubReviews')>();
  return {
    ...actual,
    createHubContentReview: (...args: unknown[]) => createHubContentReview(...args),
    loadLatestHubReviews: (...args: unknown[]) => loadLatestHubReviews(...args),
    loadHubReviewShopData: (...args: unknown[]) => loadHubReviewShopData(...args),
    assertTeamPhotoAsset: (...args: unknown[]) => assertTeamPhotoAsset(...args),
  };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequestEvent: { create: (...args: unknown[]) => eventCreate(...args) },
    previewRequest: { findUnique: (...args: unknown[]) => findUnique(...args) },
  },
}));

import { GET, POST } from './reviews';

const TOKEN = 'A'.repeat(43);

function ctx(caps = { canReview: true }) {
  return {
    token: TOKEN,
    request: { id: 'req_1', draftShopId: 'shop_1', changeRoundsUsed: 0, includedChangeRounds: 1 },
    state: { kind: 'hub', stage: 'review', capabilities: caps },
    isOperator: false,
    draft: null,
  };
}

function post(body: unknown) {
  return POST({
    request: new Request(`http://localhost/api/preview-hub/${TOKEN}/reviews`, {
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
  enforceHubReviewsRate.mockReset().mockResolvedValue(null);
  requireReviewCapability.mockReset().mockReturnValue(null);
  resolveHubApiContext.mockReset().mockResolvedValue({ ok: true, ctx: ctx() });
  createHubContentReview.mockReset().mockResolvedValue({
    id: 'rev_1',
    section: 'SERVICES',
    state: 'CONFIRMED',
    cardState: 'confirmed',
  });
  findUnique.mockReset().mockResolvedValue({ changeRoundsUsed: 0 });
  sendServerAnalyticsEvent.mockReset();
  eventCreate.mockReset();
  assertTeamPhotoAsset.mockReset().mockResolvedValue({ ok: true });
  loadLatestHubReviews.mockReset().mockResolvedValue({ SERVICES: null, TEAM: null, HOURS: null });
  loadHubReviewShopData.mockReset().mockResolvedValue({ services: [], barbers: [], hours: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/preview-hub/[token]/reviews', () => {
  it('returns 410 for SERVICES and TEAM proposals', async () => {
    for (const section of ['SERVICES', 'TEAM'] as const) {
      createHubContentReview.mockClear();
      const response = await post({ action: 'confirmed', section });
      expect(response.status).toBe(410);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('dashboard');
      expect(createHubContentReview).not.toHaveBeenCalled();
    }
  });

  it('confirms hours and does not increment changeRoundsUsed', async () => {
    createHubContentReview.mockResolvedValueOnce({
      id: 'rev_1',
      section: 'HOURS',
      state: 'CONFIRMED',
      cardState: 'confirmed',
    });
    const response = await post({ action: 'confirmed', section: 'HOURS' });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.review.id).toBe('rev_1');
    expect(body.changeRoundsUsed).toBe(0);
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'hub_review_confirmed', params: { section: 'HOURS' } }),
    );
  });

  it('404s when the hub flag is off', async () => {
    resolveHubApiContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: 'Not found.' }), { status: 404 }),
    });
    const response = await post({ action: 'confirmed', section: 'HOURS' });
    expect(response.status).toBe(404);
  });

  it('denies before Review', async () => {
    requireReviewCapability.mockReturnValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'You cannot review details at this stage.' }), { status: 403 }),
    );
    const response = await post({ action: 'confirmed', section: 'HOURS' });
    expect(response.status).toBe(403);
  });

  it('rejects invalid validation', async () => {
    const response = await post({ action: 'confirmed', section: 'LOGO' });
    expect(response.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    enforceHubReviewsRate.mockResolvedValueOnce(new Response('limited', { status: 429 }));
    const response = await post({ action: 'confirmed', section: 'HOURS' });
    expect(response.status).toBe(429);
  });

  it('sends corrections without incrementing changeRoundsUsed', async () => {
    createHubContentReview.mockResolvedValueOnce({
      id: 'rev_2',
      section: 'HOURS',
      state: 'CORRECTIONS_SENT',
      cardState: 'corrections_sent',
    });
    findUnique.mockResolvedValueOnce({ changeRoundsUsed: 0 });
    const response = await post({
      action: 'corrections',
      section: 'HOURS',
      proposal: {
        baseline: 'hours:v1',
        days: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
          dayOfWeek,
          open: dayOfWeek !== 7,
          start: '09:00',
          end: '17:00',
        })),
      },
    });
    expect(response.status).toBe(201);
    expect((await response.json()).changeRoundsUsed).toBe(0);
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'hub_review_corrections_sent', params: { section: 'HOURS' } }),
    );
    expect(createHubContentReview).toHaveBeenCalled();
  });
});

describe('GET /api/preview-hub/[token]/reviews', () => {
  it('returns latest reviews', async () => {
    const response = await GET({
      request: new Request(`http://localhost/api/preview-hub/${TOKEN}/reviews`),
      params: { token: TOKEN },
    } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });
});
