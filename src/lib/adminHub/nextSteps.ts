import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '@/lib/booking/sandboxBookings';
import { prisma } from '@/lib/db/client';
import { isAdminHubEnabled } from '@/lib/freePreview/config';
import { liveSiteUrl } from '@/lib/freePreview/hubLaunch';
import { resolvePreviewRequestByDraftShopId } from '@/lib/freePreview/previewAccess';
import {
  setupPhase3Items,
  type SetupCardModel,
} from './setupCard';

export type NextStepsPayload = SetupCardModel & {
  liveUrl: string | null;
};

function hostnameFromOnboarding(input: {
  domainMode: string | null;
  existingDomain: string | null;
  preferredDomain1: string | null;
  websiteUrl?: string | null;
}): string | null {
  const existing = (input.existingDomain ?? '').trim().replace(/^www\./, '');
  const preferred = (input.preferredDomain1 ?? '').trim().replace(/^www\./, '');
  const website = (input.websiteUrl ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  if (input.domainMode === 'EXISTING') return existing || website || null;
  if (input.domainMode === 'KERSIVO_REGISTER') return preferred || null;
  return existing || preferred || website || null;
}

export function resolveNextStepsCard(input: {
  dismissedAt: Date | null | undefined;
  viewedSiteAt: Date | null | undefined;
  hasTestBooking: boolean;
  retailCompleted: boolean;
  liveUrl: string | null;
}): NextStepsPayload | null {
  if (input.dismissedAt) return null;
  const card = setupPhase3Items({
    viewedSite: Boolean(input.viewedSiteAt),
    testBookingDone: input.hasTestBooking,
    retailDone: input.retailCompleted,
    liveUrl: input.liveUrl,
  });
  if (card.done === card.total) return null;
  return { ...card, liveUrl: input.liveUrl };
}

/** Full-admin Phase 3 card. Null when the flag is off, the shop is not a live preview, or the card is hidden. */
export async function loadFullAdminNextSteps(shopId: string): Promise<NextStepsPayload | null> {
  if (!isAdminHubEnabled() || !shopId) return null;

  const preview = await resolvePreviewRequestByDraftShopId(shopId);
  if (!preview?.liveAt) return null;

  const [shop, testBooking] = await Promise.all([
    prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: {
        nextStepsDismissedAt: true,
        nextStepsWebsiteViewedAt: true,
        retailOnboardingCompleted: true,
        clientOnboarding: {
          select: {
            domainMode: true,
            existingDomain: true,
            preferredDomain1: true,
          },
        },
      },
    }),
    prisma.booking.findFirst({
      where: {
        notes: { startsWith: OWNER_TEST_BOOKING_NOTES_PREFIX },
        service: { shopId },
      },
      select: { id: true },
    }),
  ]);
  if (!shop) return null;

  const liveUrl = liveSiteUrl(
    hostnameFromOnboarding({
      domainMode: shop.clientOnboarding?.domainMode ?? null,
      existingDomain: shop.clientOnboarding?.existingDomain ?? null,
      preferredDomain1: shop.clientOnboarding?.preferredDomain1 ?? null,
      websiteUrl: preview.websiteUrl,
    }),
  );

  return resolveNextStepsCard({
    dismissedAt: shop.nextStepsDismissedAt,
    viewedSiteAt: shop.nextStepsWebsiteViewedAt,
    hasTestBooking: Boolean(testBooking),
    retailCompleted: Boolean(shop.retailOnboardingCompleted),
    liveUrl,
  });
}

export async function markNextStepsWebsiteViewed(shopId: string): Promise<NextStepsPayload | null> {
  if (!isAdminHubEnabled() || !shopId) return null;
  const preview = await resolvePreviewRequestByDraftShopId(shopId);
  if (!preview?.liveAt) return null;
  await prisma.shopSettings.updateMany({
    where: { id: shopId, nextStepsWebsiteViewedAt: null },
    data: { nextStepsWebsiteViewedAt: new Date() },
  });
  return loadFullAdminNextSteps(shopId);
}

export async function dismissNextSteps(shopId: string): Promise<{ ok: true } | { ok: false }> {
  if (!isAdminHubEnabled() || !shopId) return { ok: false };
  const preview = await resolvePreviewRequestByDraftShopId(shopId);
  if (!preview?.liveAt) return { ok: false };
  await prisma.shopSettings.update({
    where: { id: shopId },
    data: { nextStepsDismissedAt: new Date() },
  });
  return { ok: true };
}
