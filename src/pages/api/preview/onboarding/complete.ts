export const prerender = false;

import type { APIRoute } from 'astro';
import {
  GUEST_ONBOARDING_VIEWER,
  loadOnboardingState,
  markOnboardingCompleted,
  shopMeetsOnboardingCompletionRequirements,
} from '@/lib/admin/onboarding';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import {
  PREVIEW_WRITE_RATE,
  requirePreviewOnboardingAccess,
} from '@/lib/preview/shopPreviewSession';

export const POST: APIRoute = async (ctx) => {
  const limited = await enforceIpRateLimit(
    ctx.request,
    PREVIEW_WRITE_RATE.action,
    PREVIEW_WRITE_RATE.limit,
    PREVIEW_WRITE_RATE.windowMs,
  );
  if (limited) return limited;

  const access = await requirePreviewOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    if (!(await shopMeetsOnboardingCompletionRequirements(shopId))) {
      return new Response(
        JSON.stringify({
          error: 'Finish shop, team, services and hours before continuing.',
        }),
        { status: 400 },
      );
    }

    await markOnboardingCompleted(shopId);
    const state = await loadOnboardingState(shopId, GUEST_ONBOARDING_VIEWER);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete preview onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
