export const prerender = false;

import type { APIRoute } from 'astro';
import {
  advanceOnboardingStep,
  GUEST_ONBOARDING_VIEWER,
  loadOnboardingState,
  ONBOARDING_STEP_SHOP,
} from '@/lib/admin/onboarding';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import {
  PREVIEW_WRITE_RATE,
  requirePreviewOnboardingAccess,
} from '@/lib/preview/shopPreviewSession';

export const GET: APIRoute = async (ctx) => {
  const access = await requirePreviewOnboardingAccess(ctx);
  if (access instanceof Response) return access;

  try {
    const state = await loadOnboardingState(access.shopId, GUEST_ONBOARDING_VIEWER);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load preview onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const PUT: APIRoute = async (ctx) => {
  const limited = await enforceIpRateLimit(
    ctx.request,
    PREVIEW_WRITE_RATE.action,
    PREVIEW_WRITE_RATE.limit,
    PREVIEW_WRITE_RATE.windowMs,
  );
  if (limited) return limited;

  const access = await requirePreviewOnboardingAccess(ctx);
  if (access instanceof Response) return access;

  try {
    const body = (await ctx.request.json().catch(() => ({}))) as { step?: number };
    const step = typeof body.step === 'number' ? body.step : ONBOARDING_STEP_SHOP;
    await advanceOnboardingStep(access.shopId, step);
    const state = await loadOnboardingState(access.shopId, GUEST_ONBOARDING_VIEWER);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update preview step.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
