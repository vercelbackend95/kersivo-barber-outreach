import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { createDraftShop } from '@/lib/preview/shopPreviewSession';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';

export const HUB_DRAFT_SHOP_ACTOR = 'owner:hub';

export type EnsureHubDraftShopResult =
  | { ok: true; shopId: string; created: boolean }
  | { ok: false; code: 'NOT_FOUND' | 'INVALID_TRANSITION'; httpStatus: number };

const BLOCKED_STATUSES = new Set(['REJECTED', 'DECLINED', 'EXPIRED', 'CONVERTED']);

/**
 * Idempotent: the first caller creates an ownerless paused draft shop and links it.
 * Parallel callers serialize on FOR UPDATE and reuse the same shop.
 * Ops create_draft_shop / link_draft_shop still return DRAFT_SHOP_ALREADY_LINKED if this ran first.
 */
export async function ensureHubDraftShop(previewRequestId: string): Promise<EnsureHubDraftShopResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${previewRequestId} FOR UPDATE`);
    const request = await tx.previewRequest.findUnique({
      where: { id: previewRequestId },
      select: {
        id: true,
        status: true,
        draftShopId: true,
        shopName: true,
        townCity: true,
        anonymisedAt: true,
      },
    });
    if (!request) return { ok: false, code: 'NOT_FOUND', httpStatus: 404 };
    if (request.anonymisedAt || BLOCKED_STATUSES.has(request.status)) {
      return { ok: false, code: 'INVALID_TRANSITION', httpStatus: 409 };
    }
    if (request.draftShopId) {
      return { ok: true, shopId: request.draftShopId, created: false };
    }

    const shop = await createDraftShop({ name: request.shopName, townCity: request.townCity }, tx);
    await tx.previewRequest.update({
      where: { id: request.id },
      data: {
        draftShopId: shop.id,
        events: {
          create: {
            action: PREVIEW_REQUEST_ACTIONS.DRAFT_SHOP_CREATED,
            actorEmail: HUB_DRAFT_SHOP_ACTOR,
            meta: { shopId: shop.id, source: 'hub' },
          },
        },
      },
    });
    return { ok: true, shopId: shop.id, created: true };
  });
}
