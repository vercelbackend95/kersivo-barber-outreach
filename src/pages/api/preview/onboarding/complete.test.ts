import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  requirePreviewOnboardingAccess,
  enforceIpRateLimit,
  loadOnboardingState,
  markOnboardingCompleted,
  shopMeetsOnboardingCompletionRequirements,
} = vi.hoisted(() => ({
  requirePreviewOnboardingAccess: vi.fn(),
  enforceIpRateLimit: vi.fn(),
  loadOnboardingState: vi.fn(),
  markOnboardingCompleted: vi.fn(),
  shopMeetsOnboardingCompletionRequirements: vi.fn(),
}));

vi.mock('@/lib/preview/shopPreviewSession', () => ({
  requirePreviewOnboardingAccess,
  PREVIEW_WRITE_RATE: { action: 'preview_onboarding_write', limit: 120, windowMs: 3_600_000 },
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit,
}));

vi.mock('@/lib/admin/onboarding', () => ({
  loadOnboardingState,
  markOnboardingCompleted,
  shopMeetsOnboardingCompletionRequirements,
  GUEST_ONBOARDING_VIEWER: {
    userId: null,
    userName: null,
    userEmail: null,
    userImage: null,
  },
}));

import { POST } from './complete';
import { GET } from './index';

function makeCtx(path: string, method = 'GET'): APIContext {
  return {
    request: new Request(`http://localhost${path}`, { method }),
  } as unknown as APIContext;
}

describe('guest preview onboarding auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceIpRateLimit.mockResolvedValue(null);
  });

  it('GET without cookie → 401', async () => {
    requirePreviewOnboardingAccess.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Preview session required.' }), { status: 401 }),
    );
    const res = await GET(makeCtx('/api/preview/onboarding'));
    expect(res.status).toBe(401);
    expect(loadOnboardingState).not.toHaveBeenCalled();
  });

  it('complete without auth → 401', async () => {
    requirePreviewOnboardingAccess.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Preview session required.' }), { status: 401 }),
    );
    const res = await POST(makeCtx('/api/preview/onboarding/complete', 'POST'));
    expect(res.status).toBe(401);
    expect(markOnboardingCompleted).not.toHaveBeenCalled();
  });

  it('complete with cookie shop succeeds without Better Auth', async () => {
    requirePreviewOnboardingAccess.mockResolvedValue({ shopId: 'shop_preview', sessionId: 's1' });
    shopMeetsOnboardingCompletionRequirements.mockResolvedValue(true);
    markOnboardingCompleted.mockResolvedValue(undefined);
    loadOnboardingState.mockResolvedValue({
      shop: { id: 'shop_preview', name: 'Fade', townCity: null, logoUrl: null },
      onboardingCompleted: true,
      user: null,
    });

    const res = await POST(makeCtx('/api/preview/onboarding/complete', 'POST'));
    expect(res.status).toBe(200);
    expect(markOnboardingCompleted).toHaveBeenCalledWith('shop_preview');
    const body = await res.json();
    expect(body.onboardingCompleted).toBe(true);
    expect(body.user).toBeNull();
  });
});
