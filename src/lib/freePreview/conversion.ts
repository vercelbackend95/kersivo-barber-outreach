import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { purgeShopData } from '@/lib/setup/purgeShopData';
import { normalizeSaasCheckoutIdentity } from '@/lib/setup/saasCheckoutGuard';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { suppressPendingPreviewFollowups } from './followups';
import { isPreviewHubEnabled } from './config';
import { notifyOwnerSubscribed } from './hubLaunch';

export type MarkConvertedResult = 'converted' | 'already_converted' | 'not_found';

/**
 * Webhook step for a paid free-preview checkout (spec §7): mark the request converted and link the
 * Stripe customer/subscription. Idempotent: a conditional update means redelivered or concurrent
 * events convert it once. The request must still point at the draft shop named in the metadata.
 */
export async function markPreviewRequestConverted(input: {
  previewRequestId: string;
  draftShopId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSessionId: string;
  now?: Date;
}): Promise<MarkConvertedResult> {
  const now = input.now ?? new Date();
  if (!input.draftShopId) return 'not_found';

  const updated = await prisma.previewRequest.updateMany({
    where: { id: input.previewRequestId, draftShopId: input.draftShopId, status: { not: 'CONVERTED' } },
    data: {
      status: 'CONVERTED',
      convertedAt: now,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    },
  });

  if (updated.count > 0) {
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: input.previewRequestId,
        action: PREVIEW_REQUEST_ACTIONS.CONVERTED,
        toStatus: 'CONVERTED',
        meta: { stripeSessionId: input.stripeSessionId },
      },
    });
    await suppressPendingPreviewFollowups(input.previewRequestId).catch((error) =>
      console.error('[free-preview] follow-up suppression failed', { id: input.previewRequestId, error }),
    );
    if (isPreviewHubEnabled()) {
      const request = await prisma.previewRequest.findUnique({
        where: { id: input.previewRequestId },
        select: { email: true, firstName: true, shopName: true },
      });
      if (request) {
        await notifyOwnerSubscribed({
          to: request.email,
          firstName: request.firstName,
          shopName: request.shopName,
          previewRequestId: input.previewRequestId,
        }).catch((error) =>
          console.error('[free-preview] subscribed email failed', {
            id: input.previewRequestId,
            error: error instanceof Error ? error.message : error,
          }),
        );
      }
    }
    return 'converted';
  }

  const existing = await prisma.previewRequest.findFirst({
    where: { id: input.previewRequestId, draftShopId: input.draftShopId },
    select: { status: true },
  });
  return existing?.status === 'CONVERTED' ? 'already_converted' : 'not_found';
}

export type AdoptDraftShopResult =
  | { ok: true; shopId: string; adopted: boolean }
  | {
      ok: false;
      code: 'NOT_PREVIEW_DRAFT' | 'SHOP_HAS_OWNER' | 'EMAIL_MISMATCH' | 'CURRENT_SHOP_NOT_EMPTY';
    };

type Tx = Prisma.TransactionClient;

/** The workspace a new sign-up gets automatically: owned by this user, no data, no billing. */
async function isDisposableAutoShop(tx: Tx, shopId: string, userId: string): Promise<boolean> {
  const shop = await tx.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      ownerUserId: true,
      onboardingCompleted: true,
      shopPaidAt: true,
      freeBookingActivatedAt: true,
      stripeConnectAccountId: true,
      clientOnboarding: { select: { id: true } },
      previewRequest: { select: { id: true } },
    },
  });
  if (!shop || shop.ownerUserId !== userId) return false;
  if (shop.onboardingCompleted || shop.shopPaidAt || shop.freeBookingActivatedAt || shop.stripeConnectAccountId) {
    return false;
  }
  if (shop.clientOnboarding || shop.previewRequest) return false;

  const [otherMembers, barbers, services, clients, orders, subscriptions] = await Promise.all([
    tx.shopMember.count({ where: { shopId, userId: { not: userId } } }),
    tx.barber.count({ where: { shopId } }),
    tx.service.count({ where: { shopId } }),
    tx.client.count({ where: { shopId } }),
    tx.order.count({ where: { shopId } }),
    tx.saasSubscription.count({ where: { shopId } }),
  ]);
  return otherMembers + barbers + services + clients + orders + subscriptions === 0;
}

/**
 * Hands a KERSIVO-built draft shop to the customer who paid for it, without rebuilding it (spec §7).
 * Runs at claim time, after the signed-in, verified email has been matched to the paid checkout email.
 * In one transaction: the draft must be ownerless and linked to a preview request with that email; the
 * user's automatically created empty workspace is removed; the user becomes the draft shop's owner.
 * The draft keeps its "under construction" pause, so nothing goes live until the owner approves the site.
 * Idempotent: a retry by the same user returns adopted: false.
 */
export async function adoptPreviewDraftShop(input: {
  draftShopId: string;
  userId: string;
  currentShopId: string | null;
  checkoutEmail: string;
  now?: Date;
}): Promise<AdoptDraftShopResult> {
  const now = input.now ?? new Date();
  const lockIds = [input.draftShopId, input.currentShopId]
    .filter((id): id is string => Boolean(id))
    .sort();

  return prisma.$transaction(async (tx): Promise<AdoptDraftShopResult> => {
    for (const id of new Set(lockIds)) {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${id} FOR UPDATE`);
    }

    const draft = await tx.shopSettings.findUnique({
      where: { id: input.draftShopId },
      select: {
        id: true,
        ownerUserId: true,
        previewRequest: {
          select: {
            id: true,
            email: true,
            firstName: true,
            townCity: true,
            instagramUrl: true,
            websiteUrl: true,
          },
        },
      },
    });
    const preview = draft?.previewRequest;
    if (!draft || !preview) return { ok: false, code: 'NOT_PREVIEW_DRAFT' };
    if (draft.ownerUserId === input.userId) return { ok: true, shopId: draft.id, adopted: false };
    if (draft.ownerUserId) return { ok: false, code: 'SHOP_HAS_OWNER' };

    const requestEmail = normalizeSaasCheckoutIdentity(preview.email);
    if (!requestEmail || requestEmail !== normalizeSaasCheckoutIdentity(input.checkoutEmail)) {
      return { ok: false, code: 'EMAIL_MISMATCH' };
    }

    if (input.currentShopId && input.currentShopId !== draft.id) {
      if (!(await isDisposableAutoShop(tx, input.currentShopId, input.userId))) {
        return { ok: false, code: 'CURRENT_SHOP_NOT_EMPTY' };
      }
      // ShopSettings.ownerUserId is unique: the empty auto-created workspace must go first.
      await purgeShopData(tx, input.currentShopId);
    }

    await tx.shopSettings.update({
      where: { id: draft.id },
      data: {
        ownerUserId: input.userId,
        // KERSIVO built the workspace (services, barbers, hours), so workspace onboarding is skipped.
        onboardingCompleted: true,
        onboardingCompletedAt: now,
      },
    });
    await tx.shopMember.upsert({
      where: { shopId_userId: { shopId: draft.id, userId: input.userId } },
      create: { shopId: draft.id, userId: input.userId, role: 'OWNER' },
      update: { role: 'OWNER' },
    });

    // Prefill delivery onboarding with everything the preview request already told us.
    await tx.clientOnboarding.upsert({
      where: { shopId: draft.id },
      create: {
        shopId: draft.id,
        primaryContactName: preview.firstName,
        primaryContactEmail: requestEmail,
        publicEmail: requestEmail,
        townCity: preview.townCity,
        instagramUrl: preview.instagramUrl,
        currentWebsiteUrl: preview.websiteUrl,
      },
      update: {},
    });

    await tx.previewRequestEvent.create({
      data: {
        previewRequestId: preview.id,
        action: PREVIEW_REQUEST_ACTIONS.DRAFT_SHOP_ADOPTED,
        meta: { shopId: draft.id, userId: input.userId, removedShopId: input.currentShopId },
      },
    });

    return { ok: true, shopId: draft.id, adopted: true };
  });
}
