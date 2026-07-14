export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

export const GET: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  let onboardingCompleted = true;
  let onboardingCurrentStep = 0;
  let logoUrl: string | null = null;
  let shopName: string | null = null;

  if (access.via === 'session') {
    const shop = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: {
        onboardingCompleted: true,
        onboardingCurrentStep: true,
        logoUrl: true,
        name: true,
      },
    });
    onboardingCompleted = shop?.onboardingCompleted ?? true;
    onboardingCurrentStep = shop?.onboardingCurrentStep ?? 0;
    logoUrl = shop?.logoUrl ?? null;
    shopName = shop?.name ?? null;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      shopId: access.shopId,
      onboardingCompleted,
      onboardingCurrentStep,
      shop: {
        name: shopName,
        logoUrl,
      },
      user: access.userId
        ? {
            id: access.userId,
            name: access.userName,
            email: access.userEmail,
            image: access.userImage,
          }
        : null,
      via: access.via,
    }),
  );
};
