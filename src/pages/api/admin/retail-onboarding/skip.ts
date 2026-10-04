export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '@/lib/admin/auth';
import { requireAdminProductCapability } from '@/lib/admin/productCapability';
import { prisma } from '@/lib/db/client';

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'onboarding.manage');
  if (access instanceof Response) return access;

  if (access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 403 });
  }
  const grant = await requireAdminProductCapability(access, 'RETAIL');
  if (grant instanceof Response) return grant;

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
