export const prerender = false;

import type { APIRoute } from 'astro';
import { GUEST_ONBOARDING_VIEWER, loadOnboardingState } from '@/lib/admin/onboarding';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import {
  createPreviewShopSession,
  PREVIEW_START_RATE,
  PREVIEW_TTL_MS,
  resolvePreviewAccess,
  setPreviewCookie,
} from '@/lib/preview/shopPreviewSession';

/** Start or resume a guest preview session. Idempotent when cookie already valid. */
export const POST: APIRoute = async (ctx) => {
  const limited = await enforceIpRateLimit(
    ctx.request,
    PREVIEW_START_RATE.action,
    PREVIEW_START_RATE.limit,
    PREVIEW_START_RATE.windowMs,
  );
  if (limited) return limited;

  try {
    const existing = await resolvePreviewAccess(ctx);
    if (existing) {
      const state = await loadOnboardingState(existing.shopId, GUEST_ONBOARDING_VIEWER);
      return new Response(JSON.stringify(state));
    }

    const created = await createPreviewShopSession();
    setPreviewCookie(ctx, created.token, Math.floor(PREVIEW_TTL_MS / 1000));
    const state = await loadOnboardingState(created.shopId, GUEST_ONBOARDING_VIEWER);
    return new Response(JSON.stringify(state), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start preview.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
