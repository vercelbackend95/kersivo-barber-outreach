export const prerender = false;

import type { APIRoute } from 'astro';
import {
  loadOnboardingState,
  markOnboardingCompleted,
  requireOnboardingAccess,
  shopMeetsOnboardingCompletionRequirements,
} from '@/lib/admin/onboarding';

export const POST: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
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
    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
