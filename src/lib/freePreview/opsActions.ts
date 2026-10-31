import { EmailOutboundPurpose, Prisma, type PreviewRequestStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { createDraftShop } from '@/lib/preview/shopPreviewSession';
import { SITE_VERSION_MAX, applySitePreview, normalizeSitePreviewUrl } from '@/lib/setup/sitePreview';
import { isFreePreviewFlowEnabled, isPreviewHubEnabled, previewExpiryFrom } from './config';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { buildPreviewReadyEmail, buildPreviewUpdatedEmail, previewPageUrl } from './emails';

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
  z.object({
    action: z.literal('set_site_preview'),
    previewUrl: z.string().trim().min(1).max(2000),
    siteVersion: z.string().trim().min(1).max(SITE_VERSION_MAX),
  }),
  z.object({ action: z.literal('mark_ready_and_send') }),
]);

/**
 * "Mark ready and send" applies from these statuses; CHANGES_REQUESTED sends E4, the others E3.
 * EXPIRED is how ops honours "Want another look? Email us" on the expired page: a new link period.
 */
export const MARK_READY_FROM_STATUSES: readonly PreviewRequestStatus[] = ['REQUESTED', 'IN_PROGRESS', 'CHANGES_REQUESTED', 'EXPIRED'];

export type PreviewRequestOpsAction = z.infer<typeof previewRequestOpsActionSchema>;

export type OpsActionErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'DRAFT_SHOP_ALREADY_LINKED'
  | 'SHOP_NOT_FOUND'
  | 'SHOP_HAS_OWNER'
  | 'SHOP_LINKED_ELSEWHERE'
  | 'NO_DRAFT_SHOP'
  | 'INVALID_PREVIEW_URL'
  | 'SITE_PREVIEW_MISSING'
  | 'PREVIEW_FLOW_DISABLED';

export type OpsActionResult =
  | { ok: true; status: PreviewRequestStatus; draftShopId: string | null; emailSent?: 'E3' | 'E4' }
  | { ok: false; code: OpsActionErrorCode; httpStatus: number };

function fail(code: OpsActionErrorCode, httpStatus = 409): OpsActionResult {
  return { ok: false, code, httpStatus };
}

type Tx = Prisma.TransactionClient;

async function lockRequest(tx: Tx, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${id} FOR UPDATE`);
  return tx.previewRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      draftShopId: true,
      shopName: true,
      townCity: true,
      email: true,
      firstName: true,
      publicToken: true,
      anonymisedAt: true,
      convertedAt: true,
      draftShop: { select: { sitePreviewUrl: true } },
    },
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

  if (action.action === 'set_site_preview') {
    return setSitePreview({ id: input.id, previewUrl: action.previewUrl, siteVersion: action.siteVersion, actorEmail });
  }

  const outboxIds: string[] = [];
  const result = await prisma.$transaction(async (tx): Promise<OpsActionResult> => {
    const request = await lockRequest(tx, input.id);
    if (!request) return fail('NOT_FOUND', 404);
    // The retention job has removed the personal data; nothing may be written back onto the record.
    if (request.anonymisedAt) return fail('INVALID_TRANSITION');

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

      case 'mark_ready_and_send': {
        if (!isFreePreviewFlowEnabled()) return fail('PREVIEW_FLOW_DISABLED');
        if (!MARK_READY_FROM_STATUSES.includes(request.status)) return fail('INVALID_TRANSITION');
        if (!request.draftShopId) return fail('NO_DRAFT_SHOP');
        if (!request.draftShop?.sitePreviewUrl) return fail('SITE_PREVIEW_MISSING');

        const isUpdate = request.status === 'CHANGES_REQUESTED';
        const expiresAt = previewExpiryFrom(now);
        const nextStatus = request.convertedAt ? 'CONVERTED' : 'READY';
        const completedItems =
          isUpdate && isPreviewHubEnabled()
            ? await loadCompletedChangesForUpdateEmail(tx, request.id)
            : [];
        const event = await tx.previewRequestEvent.create({
          data: {
            previewRequestId: request.id,
            action: PREVIEW_REQUEST_ACTIONS.MARKED_READY,
            fromStatus: request.status,
            toStatus: nextStatus,
            actorEmail,
            meta: { email: isUpdate ? 'E4' : 'E3', expiresAt: expiresAt.toISOString() },
          },
          select: { id: true },
        });
        await tx.previewRequest.update({
          where: { id: request.id },
          data: { status: nextStatus, previewReadyAt: now, expiresAt },
        });

        const emailInput = {
          to: request.email,
          firstName: request.firstName,
          shopName: request.shopName,
          previewUrl: previewPageUrl(request.publicToken),
          expiresAt,
          completedItems,
        };
        const email = isUpdate ? buildPreviewUpdatedEmail(emailInput) : buildPreviewReadyEmail(emailInput);
        const row = await enqueueEmail(tx, {
          shopId: null,
          purpose: isUpdate ? EmailOutboundPurpose.FREE_PREVIEW_UPDATED : EmailOutboundPurpose.FREE_PREVIEW_READY,
          ...email,
          dedupeKey: `free-preview:${isUpdate ? 'updated' : 'ready'}:${request.id}:${event.id}`,
        });
        outboxIds.push(row.id);
        return { ok: true, status: nextStatus, draftShopId: request.draftShopId, emailSent: isUpdate ? 'E4' : 'E3' };
      }
    }
  });

  await Promise.all(outboxIds.map((id) => tryDeliverOutboxEmail(id)));
  return result;
}

async function setSitePreview(input: {
  id: string;
  previewUrl: string;
  siteVersion: string;
  actorEmail: string;
}): Promise<OpsActionResult> {
  const previewUrl = normalizeSitePreviewUrl(input.previewUrl);
  if (!previewUrl) return fail('INVALID_PREVIEW_URL', 400);

  const request = await prisma.previewRequest.findUnique({
    where: { id: input.id },
    select: { id: true, status: true, draftShopId: true },
  });
  if (!request) return fail('NOT_FOUND', 404);
  if (FINAL_PREVIEW_STATUSES.includes(request.status)) return fail('INVALID_TRANSITION');
  if (!request.draftShopId) return fail('NO_DRAFT_SHOP');

  const applied = await applySitePreview({
    shopId: request.draftShopId,
    previewUrl,
    siteVersion: input.siteVersion.trim(),
    email: input.actorEmail,
  });
  if (!applied.ok) return fail('SHOP_NOT_FOUND', 404);

  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: request.id,
      action: PREVIEW_REQUEST_ACTIONS.SITE_PREVIEW_SET,
      actorEmail: input.actorEmail,
      meta: { previewUrl, siteVersion: input.siteVersion.trim() },
    },
  });
  return { ok: true, status: request.status, draftShopId: request.draftShopId };
}

async function loadCompletedChangesForUpdateEmail(tx: Tx, previewRequestId: string) {
  const lastReady = await tx.previewRequestEvent.findFirst({
    where: { previewRequestId, action: PREVIEW_REQUEST_ACTIONS.MARKED_READY },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const rows = await tx.previewChangeRequest.findMany({
    where: {
      previewRequestId,
      status: { in: ['DONE', 'NOT_POSSIBLE'] },
      resolvedAt: lastReady ? { gt: lastReady.createdAt } : { not: null },
    },
    orderBy: { resolvedAt: 'asc' },
    select: { page: true, body: true, status: true, opsNote: true },
  });
  return rows.map((row) => ({
    page: row.page,
    body: row.body,
    status: row.status as 'DONE' | 'NOT_POSSIBLE',
    opsNote: row.opsNote,
  }));
}
