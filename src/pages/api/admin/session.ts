export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../lib/admin/auth';
import { healOnboardingCompletedIfEligible } from '../../../lib/admin/onboarding';
import { prisma } from '../../../lib/db/client';

export const GET: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  let onboardingCompleted = true;
  let onboardingCurrentStep = 0;
  let retailOnboardingCompleted = true;
  let retailOnboardingSkipped = false;
  let retailTestOrderId: string | null = null;
  let retailTestOrderCompletedAt: string | null = null;
  let retailPickupWalkthroughCompletedAt: string | null = null;
  let logoUrl: string | null = null;
  let shopName: string | null = null;

  if (access.via === 'session') {
    await healOnboardingCompletedIfEligible(access.shopId);

    const shop = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: {
        onboardingCompleted: true,
        onboardingCurrentStep: true,
        retailOnboardingCompleted: true,
        retailOnboardingSkipped: true,
        retailOnboardingProductId: true,
        retailTestOrderId: true,
        retailTestOrderCompletedAt: true,
        retailPickupWalkthroughCompletedAt: true,
        logoUrl: true,
        name: true,
      },
    });
    onboardingCompleted = shop?.onboardingCompleted ?? true;
    onboardingCurrentStep = shop?.onboardingCurrentStep ?? 0;
    retailOnboardingCompleted = shop?.retailOnboardingCompleted ?? false;
    retailOnboardingSkipped = shop?.retailOnboardingSkipped ?? false;
    retailTestOrderId = shop?.retailTestOrderId ?? null;
    retailTestOrderCompletedAt = shop?.retailTestOrderCompletedAt?.toISOString() ?? null;
    retailPickupWalkthroughCompletedAt =
      shop?.retailPickupWalkthroughCompletedAt?.toISOString() ?? null;
    const retailOnboardingProductId = shop?.retailOnboardingProductId ?? null;
    logoUrl = shop?.logoUrl ?? null;
    shopName = shop?.name ?? null;

    return new Response(
      JSON.stringify({
        ok: true,
        shopId: access.shopId,
        onboardingCompleted,
        onboardingCurrentStep,
        retailOnboardingCompleted,
        retailOnboardingSkipped,
        retailOnboardingProductId,
        retailTestOrderId,
        retailTestOrderCompletedAt,
        retailPickupWalkthroughCompletedAt,
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
  }

  return new Response(
    JSON.stringify({
      ok: true,
      shopId: access.shopId,
      onboardingCompleted,
      onboardingCurrentStep,
      retailOnboardingCompleted,
      retailOnboardingSkipped,
      retailOnboardingProductId: null,
      retailTestOrderId,
      retailTestOrderCompletedAt,
      retailPickupWalkthroughCompletedAt,
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
