import { Prisma, type PreviewRequestStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { createDraftShop } from '@/lib/preview/shopPreviewSession';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';

/** Statuses ops can set by hand in Batch 1. READY / CHANGES_REQUESTED come from "Mark ready and send". */
export const OPS_SETTABLE_STATUSES = ['REQUESTED', 'IN_PROGRESS'] as const satisfies readonly PreviewRequestStatus[];

/** Terminal statuses: no further ops changes except notes. */
export const FINAL_PREVIEW_STATUSES: readonly PreviewRequestStatus[] = ['CONVERTED', 'REJECTED'];

export const INTERNAL_NOTES_MAX = 5000;

export const previewRequestOpsActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update_notes'), internalNotes: z.string().max(INTERNAL_NOTES_MAX) }),
  z.object({ action: z.literal('set_status'), status: z.enum(OPS_SETTABLE_STATUSES) }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('create_draft_shop') }),
  z.object({ action: z.literal('link_draft_shop'), shopId: z.string().trim().min(1).max(64) }),
]);

export type PreviewRequestOpsAction = z.infer<typeof previewRequestOpsActionSchema>;

export type OpsActionErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'DRAFT_SHOP_ALREADY_LINKED'
  | 'SHOP_NOT_FOUND'
  | 'SHOP_HAS_OWNER'
  | 'SHOP_LINKED_ELSEWHERE';

export type OpsActionResult =
  | { ok: true; status: PreviewRequestStatus; draftShopId: string | null }
  | { ok: false; code: OpsActionErrorCode; httpStatus: number };

function fail(code: OpsActionErrorCode, httpStatus = 409): OpsActionResult {
  return { ok: false, code, httpStatus };
}

type Tx = Prisma.TransactionClient;

async function lockRequest(tx: Tx, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${id} FOR UPDATE`);
  return tx.previewRequest.findUnique({
    where: { id },
    select: { id: true, status: true, draftShopId: true, shopName: true, townCity: true },
  });
}

/** Applies one operator action atomically and records it in PreviewRequestEvent. */
export async function executePreviewRequestOpsAction(input: {
  id: string;
  action: PreviewRequestOpsAction;
  actorEmail: string;
  now?: Date;
}): Promise<OpsActionResult> {
  const now = input.now ?? new Date();
  const { action, actorEmail } = input;

  return prisma.$transaction(async (tx) => {
    const request = await lockRequest(tx, input.id);
    if (!request) return fail('NOT_FOUND', 404);

    const isFinal = FINAL_PREVIEW_STATUSES.includes(request.status);
    const done = (status: PreviewRequestStatus, draftShopId: string | null): OpsActionResult => ({
      ok: true,
      status,
      draftShopId,
    });

    switch (action.action) {
      case 'update_notes': {
        await tx.previewRequest.update({
          where: { id: request.id },
          data: {
            internalNotes: action.internalNotes.trim() || null,
            events: { create: { action: PREVIEW_REQUEST_ACTIONS.NOTES_UPDATED, actorEmail } },
          },
        });
        return done(request.status, request.draftShopId);
      }

      case 'set_status': {
        const allowedFrom: readonly PreviewRequestStatus[] = ['REQUESTED', 'IN_PROGRESS'];
        if (!allowedFrom.includes(request.status)) return fail('INVALID_TRANSITION');
        if (request.status === action.status) return done(request.status, request.draftShopId);
        await tx.previewRequest.update({
          where: { id: request.id },
          data: {
            status: action.status,
            events: {
              create: {
                action: PREVIEW_REQUEST_ACTIONS.STATUS_CHANGED,
                fromStatus: request.status,
                toStatus: action.status,
                actorEmail,
              },
            },
          },
        });
        return done(action.status, request.draftShopId);
      }

      case 'reject': {
        if (isFinal) return fail('INVALID_TRANSITION');
        await tx.previewRequest.update({
          where: { id: request.id },
          data: {
            status: 'REJECTED',
            rejectedAt: now,
            events: {
              create: {
                action: PREVIEW_REQUEST_ACTIONS.REJECTED,
                fromStatus: request.status,
                toStatus: 'REJECTED',
                actorEmail,
              },
            },
          },
        });
        return done('REJECTED', request.draftShopId);
      }

      case 'create_draft_shop': {
        if (isFinal) return fail('INVALID_TRANSITION');
        if (request.draftShopId) return fail('DRAFT_SHOP_ALREADY_LINKED');
        const shop = await createDraftShop({ name: request.shopName, townCity: request.townCity }, tx);
        await tx.previewRequest.update({
          where: { id: request.id },
          data: {
            draftShopId: shop.id,
            events: {
              create: { action: PREVIEW_REQUEST_ACTIONS.DRAFT_SHOP_CREATED, actorEmail, meta: { shopId: shop.id } },
            },
          },
        });
        return done(request.status, shop.id);
      }

      case 'link_draft_shop': {
        if (isFinal) return fail('INVALID_TRANSITION');
        if (request.draftShopId) return fail('DRAFT_SHOP_ALREADY_LINKED');
        const shop = await tx.shopSettings.findUnique({
          where: { id: action.shopId },
          select: { id: true, ownerUserId: true, previewRequest: { select: { id: true } } },
        });
        if (!shop) return fail('SHOP_NOT_FOUND', 404);
        // Only an ownerless draft can later be handed to the customer who subscribes.
        if (shop.ownerUserId) return fail('SHOP_HAS_OWNER');
        if (shop.previewRequest) return fail('SHOP_LINKED_ELSEWHERE');
        await tx.previewRequest.update({
          where: { id: request.id },
          data: {
            draftShopId: shop.id,
            events: {
              create: { action: PREVIEW_REQUEST_ACTIONS.DRAFT_SHOP_LINKED, actorEmail, meta: { shopId: shop.id } },
            },
          },
        });
        return done(request.status, shop.id);
      }
    }
  });
}
