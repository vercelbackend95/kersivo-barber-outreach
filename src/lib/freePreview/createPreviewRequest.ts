import { EmailOutboundPurpose } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { mintPreviewToken } from '@/lib/preview/shopPreviewSession';
import { buildPreviewRequestAcknowledgementEmail, buildPreviewRequestInternalEmail } from './emails';
import type { FreePreviewRequestInput } from './intake';

export const PREVIEW_REQUEST_ACTIONS = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  NOTES_UPDATED: 'NOTES_UPDATED',
  DRAFT_SHOP_CREATED: 'DRAFT_SHOP_CREATED',
  DRAFT_SHOP_LINKED: 'DRAFT_SHOP_LINKED',
  REJECTED: 'REJECTED',
} as const;

/**
 * Stores a public preview request and queues E1 (owner) + E2 (internal) in the same transaction,
 * then attempts immediate delivery. The outbox cron retries anything that fails.
 */
export async function createPreviewRequest(
  input: FreePreviewRequestInput,
  now: Date = new Date(),
): Promise<{ id: string }> {
  const { request, outboxIds } = await prisma.$transaction(async (tx) => {
    const request = await tx.previewRequest.create({
      data: {
        publicToken: mintPreviewToken(),
        firstName: input.firstName,
        email: input.email,
        shopName: input.shopName,
        townCity: input.townCity,
        bookingPageUrl: input.bookingPageUrl,
        instagramUrl: input.instagramUrl,
        googleListingUrl: input.googleListingUrl,
        websiteUrl: input.websiteUrl,
        barberCount: input.barberCount,
        currentBookingSystem: input.currentBookingSystem,
        hasOwnDomain: input.hasOwnDomain,
        notes: input.notes,
        authorisationConsentAt: now,
        marketingOptInAt: input.marketingOptIn ? now : null,
        entryPoint: input.entryPoint,
        events: { create: { action: PREVIEW_REQUEST_ACTIONS.CREATED, toStatus: 'REQUESTED' } },
      },
    });

    const ack = buildPreviewRequestAcknowledgementEmail({
      to: request.email,
      firstName: request.firstName,
      shopName: request.shopName,
    });
    const ackRow = await enqueueEmail(tx, {
      shopId: null,
      purpose: EmailOutboundPurpose.FREE_PREVIEW_REQUEST_ACKNOWLEDGEMENT,
      ...ack,
      dedupeKey: `free-preview:ack:${request.id}`,
    });

    const internal = buildPreviewRequestInternalEmail({
      ...request,
      marketingOptIn: Boolean(request.marketingOptInAt),
    });
    const internalRow = await enqueueEmail(tx, {
      shopId: null,
      purpose: EmailOutboundPurpose.FREE_PREVIEW_REQUEST_INTERNAL,
      ...internal,
      dedupeKey: `free-preview:internal:${request.id}`,
    });

    return { request, outboxIds: [ackRow.id, internalRow.id] };
  });

  await Promise.all(outboxIds.map((id) => tryDeliverOutboxEmail(id)));
  return { id: request.id };
}
