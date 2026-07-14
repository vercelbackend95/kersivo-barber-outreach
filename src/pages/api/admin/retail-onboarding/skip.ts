export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { prisma } from '@/lib/db/client';

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  if (access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 403 });
  }

  try {
    const shop = await prisma.shopSettings.update({
      where: { id: access.shopId },
      data: {
        retailOnboardingSkipped: true,
      },
      select: {
        retailOnboardingCompleted: true,
        retailOnboardingSkipped: true,
        retailOnboardingCompletedAt: true,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        retailOnboardingCompleted: shop.retailOnboardingCompleted,
        retailOnboardingSkipped: shop.retailOnboardingSkipped,
        retailOnboardingCompletedAt: shop.retailOnboardingCompletedAt,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to skip retail onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
