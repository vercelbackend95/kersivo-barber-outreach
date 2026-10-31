import { EmailOutboundPurpose, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { hashPreviewToken } from '@/lib/preview/shopPreviewSession';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { buildPreviewRequestDetailsInternalEmail } from './emails';
import type { FreePreviewDetailsInput } from './intake';

export type SavePreviewDetailsResult =
  | { ok: true; updated: boolean }
  | { ok: false; code: 'NOT_FOUND' | 'EXPIRED'; httpStatus: number };

/**
 * Step 2 of the public form: optional details on the request the token belongs to. Answered fields
 * overwrite, unanswered ones stay. Ops get a short follow-up email; the log records field names only.
 */
export async function savePreviewRequestDetails(
  input: FreePreviewDetailsInput,
  now: Date = new Date(),
): Promise<SavePreviewDetailsResult> {
  const request = await prisma.previewRequest.findUnique({
    where: { detailsTokenHash: hashPreviewToken(input.token) },
    select: {
      id: true,
      email: true,
      shopName: true,
      townCity: true,
      detailsTokenExpiresAt: true,
      marketingOptInAt: true,
    },
  });
  if (!request) return { ok: false, code: 'NOT_FOUND', httpStatus: 404 };
  if (!request.detailsTokenExpiresAt || request.detailsTokenExpiresAt <= now) {
    return { ok: false, code: 'EXPIRED', httpStatus: 410 };
  }

  const data: Prisma.PreviewRequestUpdateInput = {};
  if (input.barberCount) data.barberCount = input.barberCount;
  if (input.currentBookingSystem) data.currentBookingSystem = input.currentBookingSystem;
  if (input.hasOwnDomain) data.hasOwnDomain = input.hasOwnDomain;
  if (input.firstName) data.firstName = input.firstName;
  if (input.notes) data.notes = input.notes;
  if (input.marketingOptIn === true && !request.marketingOptInAt) data.marketingOptInAt = now;
  if (input.marketingOptIn === false && request.marketingOptInAt) data.marketingOptInAt = null;

  const fields = Object.keys(data);
  if (!fields.length) return { ok: true, updated: false };

  const outboxId = await prisma.$transaction(async (tx) => {
    await tx.previewRequest.update({ where: { id: request.id }, data });
    const event = await tx.previewRequestEvent.create({
      data: {
        previewRequestId: request.id,
        action: PREVIEW_REQUEST_ACTIONS.DETAILS_UPDATED,
        meta: { fields },
      },
      select: { id: true },
    });
    const email = buildPreviewRequestDetailsInternalEmail({
      id: request.id,
      email: request.email,
      shopName: request.shopName,
      townCity: request.townCity,
      barberCount: input.barberCount,
      currentBookingSystem: input.currentBookingSystem,
      hasOwnDomain: input.hasOwnDomain,
      firstName: input.firstName,
      notes: input.notes,
      marketingOptIn: 'marketingOptInAt' in data ? input.marketingOptIn : undefined,
    });
    const row = await enqueueEmail(tx, {
      shopId: null,
      purpose: EmailOutboundPurpose.FREE_PREVIEW_REQUEST_INTERNAL,
      ...email,
      dedupeKey: `free-preview:details:${request.id}:${event.id}`,
    });
    return row.id;
  });

  await tryDeliverOutboxEmail(outboxId);
  return { ok: true, updated: true };
}
