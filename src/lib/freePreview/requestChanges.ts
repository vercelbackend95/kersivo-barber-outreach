import { EmailOutboundPurpose, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { buildPreviewChangesRequestedInternalEmail } from './emails';
import { ownerCanActOnPreview, resolvePreviewRequestByToken } from './previewAccess';

export const PREVIEW_CHANGES_MAX = 2000;

export const previewChangesSchema = z.object({
  changes: z.string().trim().min(1).max(PREVIEW_CHANGES_MAX),
});

export type RequestPreviewChangesResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_AVAILABLE'; httpStatus: number };

/**
 * Owner asks for changes from the preview: status → CHANGES_REQUESTED and an internal email to
 * PREVIEW_NOTIFY_EMAIL (spec §6). A second message before ops marks it ready again replaces the text;
 * every message is kept in the event log.
 */
export async function requestPreviewChanges(input: {
  token: string;
  changes: string;
  now?: Date;
}): Promise<RequestPreviewChangesResult> {
  const now = input.now ?? new Date();
  const found = await resolvePreviewRequestByToken(input.token);
  if (!found) return { ok: false, code: 'NOT_FOUND', httpStatus: 404 };

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${found.id} FOR UPDATE`);
    const request = await tx.previewRequest.findUnique({
      where: { id: found.id },
      select: { id: true, status: true, expiresAt: true, draftShopId: true, email: true, shopName: true, townCity: true },
    });
    if (!request || !ownerCanActOnPreview(request, now)) return null;

    const event = await tx.previewRequestEvent.create({
      data: {
        previewRequestId: request.id,
        action: PREVIEW_REQUEST_ACTIONS.CHANGES_REQUESTED,
        fromStatus: request.status,
        toStatus: 'CHANGES_REQUESTED',
        meta: { changes: input.changes },
      },
      select: { id: true },
    });
    await tx.previewRequest.update({
      where: { id: request.id },
      data: { status: 'CHANGES_REQUESTED', changesRequestedText: input.changes, changesRequestedAt: now },
    });
    const email = buildPreviewChangesRequestedInternalEmail({ ...request, changesText: input.changes });
    const row = await enqueueEmail(tx, {
      shopId: null,
      purpose: EmailOutboundPurpose.FREE_PREVIEW_CHANGES_REQUESTED_INTERNAL,
      ...email,
      dedupeKey: `free-preview:changes:${request.id}:${event.id}`,
    });
    return row.id;
  });

  if (!outcome) return { ok: false, code: 'NOT_AVAILABLE', httpStatus: 409 };
  await tryDeliverOutboxEmail(outcome);
  return { ok: true };
}
