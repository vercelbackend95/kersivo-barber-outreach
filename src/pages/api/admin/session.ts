export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../lib/admin/auth';
import { healOnboardingCompletedIfEligible } from '../../../lib/admin/onboarding';
import { isPauseActiveNow } from '../../../lib/admin/shopPublicActivity';
import { prisma } from '../../../lib/db/client';

export const GET: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  let onboardingCompleted = true;
  let onboardingCurrentStep = 0;
  let retailOnboardingCompleted = true;
  let retailOnboardingSkipped = false;
  let retailOnboardingProductId: string | null = null;
  let retailTestOrderId: string | null = null;
  let retailTestOrderCompletedAt: string | null = null;
  let retailPickupWalkthroughCompletedAt: string | null = null;
  let logoUrl: string | null = null;
  let shopName: string | null = null;
  let publicActivityPaused = false;

  if (access.via === 'session') {
    try {
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
          timezone: true,
          publicActivityPaused: true,
          publicActivityPauseFrom: true,
          publicActivityPauseUntil: true,
          publicActivityPauseReason: true,
        },
      });
      onboardingCompleted = shop?.onboardingCompleted ?? true;
      onboardingCurrentStep = shop?.onboardingCurrentStep ?? 0;
      retailOnboardingCompleted = shop?.retailOnboardingCompleted ?? false;
      retailOnboardingSkipped = shop?.retailOnboardingSkipped ?? false;
      retailOnboardingProductId = shop?.retailOnboardingProductId ?? null;
      retailTestOrderId = shop?.retailTestOrderId ?? null;
      retailTestOrderCompletedAt = shop?.retailTestOrderCompletedAt?.toISOString() ?? null;
      retailPickupWalkthroughCompletedAt =
        shop?.retailPickupWalkthroughCompletedAt?.toISOString() ?? null;
      logoUrl = shop?.logoUrl ?? null;
      shopName = shop?.name ?? null;
      publicActivityPaused = shop ? isPauseActiveNow(shop) : false;
    } catch (error) {
      console.error('Failed to load admin session shop settings', error);
      return new Response(JSON.stringify({ error: 'Could not load admin session.' }), {
        status: 500,
      });
    }

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
          publicActivityPaused,
        },
        user: access.userId
          ? {
              id: access.userId,
              name: access.userName,
              email: access.userEmail,
              image: access.userImage,
            }
          : null,
        role: access.role,
        barberId: access.barberId,
        permissions: access.permissions,
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
        publicActivityPaused,
      },
      user: access.userId
        ? {
            id: access.userId,
            name: access.userName,
            email: access.userEmail,
            image: access.userImage,
          }
        : null,
      role: access.role,
      barberId: access.barberId,
      permissions: access.permissions,
      via: access.via,
    }),
  );
};
