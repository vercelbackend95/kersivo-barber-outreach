export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { prisma } from '@/lib/db/client';

/**
 * Clear retail journey markers so the owner can replay full retail onboarding.
 * Does not delete products or historical orders.
 */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  if (access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 403 });
  }

  try {
    await prisma.shopSettings.update({
      where: { id: access.shopId },
      data: {
        retailOnboardingCompleted: false,
        retailOnboardingSkipped: false,
        retailOnboardingCompletedAt: null,
        retailOnboardingProductId: null,
        retailTestOrderId: null,
        retailTestOrderCompletedAt: null,
        retailPickupWalkthroughCompletedAt: null,
      },
    });

    return new Response(JSON.stringify({ ok: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset retail onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
