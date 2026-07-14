export const prerender = false;

import type { APIRoute } from 'astro';
import { loadOnboardingState, requireOnboardingAccess } from '@/lib/admin/onboarding';
import { prisma } from '@/lib/db/client';

export const POST: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    await prisma.shopSettings.update({
      where: { id: shopId },
      data: {
        onboardingCompleted: false,
        onboardingCurrentStep: 0,
        onboardingCompletedAt: null,
      },
    });

    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to restart onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
