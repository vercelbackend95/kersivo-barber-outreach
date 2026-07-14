export const prerender = false;

import type { APIRoute } from 'astro';
import {
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_SHOP,
  requireOnboardingAccess,
} from '@/lib/admin/onboarding';

export const GET: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;

  try {
    const state = await loadOnboardingState(access.shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load onboarding state.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const PUT: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;

  try {
    const body = (await ctx.request.json().catch(() => ({}))) as { step?: number };
    const step = typeof body.step === 'number' ? body.step : ONBOARDING_STEP_SHOP;
    await advanceOnboardingStep(access.shopId, step);
    const state = await loadOnboardingState(access.shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update onboarding step.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
