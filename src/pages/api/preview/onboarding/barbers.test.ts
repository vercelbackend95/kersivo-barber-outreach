import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const {
  requirePreviewOnboardingAccess,
  enforceIpRateLimit,
  advanceOnboardingStep,
  loadOnboardingState,
  barberFindMany,
  barberCreate,
  barberUpdate,
  barberUpdateMany,
  prismaTransaction,
} = vi.hoisted(() => ({
  requirePreviewOnboardingAccess: vi.fn(),
  enforceIpRateLimit: vi.fn(),
  advanceOnboardingStep: vi.fn(),
  loadOnboardingState: vi.fn(),
  barberFindMany: vi.fn(),
  barberCreate: vi.fn(),
  barberUpdate: vi.fn(),
  barberUpdateMany: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock('@/lib/preview/shopPreviewSession', () => ({
  requirePreviewOnboardingAccess,
  PREVIEW_WRITE_RATE: { action: 'preview_onboarding_write', limit: 120, windowMs: 3_600_000 },
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit,
}));

vi.mock('@/lib/admin/onboarding', () => ({
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_SERVICES: 4,
  GUEST_ONBOARDING_VIEWER: {
    userId: null,
    userName: null,
    userEmail: null,
    userImage: null,
  },
}));

vi.mock('@/lib/storage/vercelBlob', () => ({
  getBlobReadWriteToken: () => null,
  makeBlobPath: () => 'path',
  uploadPublicImageToBlob: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    barber: {
      findMany: (...a: unknown[]) => barberFindMany(...a),
      create: (...a: unknown[]) => barberCreate(...a),
      update: (...a: unknown[]) => barberUpdate(...a),
      updateMany: (...a: unknown[]) => barberUpdateMany(...a),
    },
    $transaction: (...a: unknown[]) => prismaTransaction(...a),
  },
}));

import { PUT } from './barbers';

function makeJsonCtx(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/preview/onboarding/barbers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('PUT /api/preview/onboarding/barbers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceIpRateLimit.mockResolvedValue(null);
    requirePreviewOnboardingAccess.mockResolvedValue({ shopId: 'shop_cookie', sessionId: 's1' });
    barberFindMany.mockResolvedValue([]);
    prismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        barber: {
          create: barberCreate,
          update: barberUpdate,
          updateMany: barberUpdateMany,
        },
      };
      return fn(tx);
    });
    barberCreate.mockResolvedValue({ id: 'b1' });
    loadOnboardingState.mockResolvedValue({ shop: { id: 'shop_cookie' }, barbers: [] });
  });

  it('rejects without cookie (401)', async () => {
    requirePreviewOnboardingAccess.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Preview session required.' }), { status: 401 }),
    );
    const res = await PUT(makeJsonCtx({ barbers: [{ name: 'Alex' }] }));
    expect(res.status).toBe(401);
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('scopes writes to cookie shop, ignoring any client shopId', async () => {
    const res = await PUT(
      makeJsonCtx({
        shopId: 'stolen_shop',
        barbers: [{ name: 'Alex' }],
      }),
    );
    expect(res.status).toBe(200);
    expect(barberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shopId: 'shop_cookie', name: 'Alex' }),
      }),
    );
    expect(advanceOnboardingStep).toHaveBeenCalledWith('shop_cookie', 4);
  });
});
