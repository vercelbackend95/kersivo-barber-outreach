import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  enforceIpRateLimit,
  resolvePreviewAccess,
  createPreviewShopSession,
  setPreviewCookie,
  loadOnboardingState,
} = vi.hoisted(() => ({
  enforceIpRateLimit: vi.fn(),
  resolvePreviewAccess: vi.fn(),
  createPreviewShopSession: vi.fn(),
  setPreviewCookie: vi.fn(),
  loadOnboardingState: vi.fn(),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit,
}));

vi.mock('@/lib/preview/shopPreviewSession', () => ({
  resolvePreviewAccess,
  createPreviewShopSession,
  setPreviewCookie,
  PREVIEW_START_RATE: { action: 'preview_onboarding_start', limit: 8, windowMs: 3_600_000 },
  PREVIEW_TTL_MS: 7 * 24 * 60 * 60 * 1000,
}));

vi.mock('@/lib/admin/onboarding', () => ({
  loadOnboardingState,
  GUEST_ONBOARDING_VIEWER: {
    userId: null,
    userName: null,
    userEmail: null,
    userImage: null,
  },
}));

import { POST } from './start';

function makeCtx(cookie?: string): APIContext {
  return {
    request: new Request('http://localhost/api/preview/onboarding/start', {
      method: 'POST',
      headers: cookie ? { cookie } : {},
    }),
    cookies: {
      get: () => undefined,
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as APIContext;
}

describe('POST /api/preview/onboarding/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceIpRateLimit.mockResolvedValue(null);
    loadOnboardingState.mockResolvedValue({
      shop: { id: 'shop_1', name: 'My Barbershop', townCity: null, logoUrl: null },
      onboardingCompleted: false,
      onboardingCurrentStep: 0,
      barbers: [],
      services: [],
      user: null,
    });
  });

  it('rate-limits unauthenticated starts', async () => {
    enforceIpRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests.' }), { status: 429 }),
    );
    const res = await POST(makeCtx());
    expect(res.status).toBe(429);
    expect(createPreviewShopSession).not.toHaveBeenCalled();
  });

  it('creates orphan shop + sets cookie when no session', async () => {
    resolvePreviewAccess.mockResolvedValue(null);
    createPreviewShopSession.mockResolvedValue({
      shopId: 'shop_1',
      token: 'preview-token',
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const ctx = makeCtx();
    const res = await POST(ctx);
    expect(res.status).toBe(201);
    expect(createPreviewShopSession).toHaveBeenCalledOnce();
    expect(setPreviewCookie).toHaveBeenCalledWith(ctx, 'preview-token', expect.any(Number));
    expect(loadOnboardingState).toHaveBeenCalledWith(
      'shop_1',
      expect.objectContaining({ userId: null }),
    );
  });

  it('resumes existing cookie session without creating a shop', async () => {
    resolvePreviewAccess.mockResolvedValue({ shopId: 'shop_existing', sessionId: 'sess_1' });
    const res = await POST(makeCtx('kersivo_shop_preview=abc'));
    expect(res.status).toBe(200);
    expect(createPreviewShopSession).not.toHaveBeenCalled();
    expect(setPreviewCookie).not.toHaveBeenCalled();
    expect(loadOnboardingState).toHaveBeenCalledWith('shop_existing', expect.any(Object));
  });
});
