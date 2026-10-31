import { EmailOutboundPurpose, Prisma } from '@prisma/client';
import { getLondonDayBounds } from '@/lib/admin/barberRosterPresentation';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { hashPreviewToken, mintPreviewToken } from '@/lib/preview/shopPreviewSession';
import { getFreePreviewDailyCap } from './config';
import { buildPreviewRequestAcknowledgementEmail, buildPreviewRequestInternalEmail } from './emails';
import type { FreePreviewRequestInput } from './intake';

export const PREVIEW_REQUEST_ACTIONS = {
  CREATED: 'CREATED',
  OVER_DAILY_CAP: 'OVER_DAILY_CAP',
  STATUS_CHANGED: 'STATUS_CHANGED',
  NOTES_UPDATED: 'NOTES_UPDATED',
  DRAFT_SHOP_CREATED: 'DRAFT_SHOP_CREATED',
  DRAFT_SHOP_LINKED: 'DRAFT_SHOP_LINKED',
  REJECTED: 'REJECTED',
  SITE_PREVIEW_SET: 'SITE_PREVIEW_SET',
  MARKED_READY: 'MARKED_READY',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  CHECKOUT_STARTED: 'CHECKOUT_STARTED',
  CONVERTED: 'CONVERTED',
  DRAFT_SHOP_ADOPTED: 'DRAFT_SHOP_ADOPTED',
  FOLLOWUP_SENT: 'FOLLOWUP_SENT',
  EXPIRY_REMINDER_SENT: 'EXPIRY_REMINDER_SENT',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  ANONYMISED: 'ANONYMISED',
} as const;

/**
 * Stores a public preview request and queues E1 (owner) + E2 (internal) in the same transaction,
 * then attempts immediate delivery. The outbox cron retries anything that fails.
 * Requests over the daily cap are still saved; they carry an OVER_DAILY_CAP event and a longer-wait message.
 */
export async function createPreviewRequest(
  input: FreePreviewRequestInput,
  now: Date = new Date(),
): Promise<{ id: string; overDailyCap: boolean }> {
  const publicToken = mintPreviewToken();
  const { request, outboxIds, overDailyCap } = await prisma.$transaction(async (tx) => {
    const requestsToday = await tx.previewRequest.count({
      where: { createdAt: { gte: new Date(getLondonDayBounds(now).startMs) } },
    });
    const overDailyCap = requestsToday >= getFreePreviewDailyCap();

    const request = await tx.previewRequest.create({
      data: {
        publicToken,
        publicTokenHash: hashPreviewToken(publicToken),
        firstName: input.firstName,
        email: input.email,
        shopName: input.shopName,
        townCity: input.townCity,
        bookingPageUrl: input.bookingPageUrl,
        instagramUrl: input.instagramUrl,
        googleListingUrl: input.googleListingUrl,
        websiteUrl: input.websiteUrl,
        workLinks: input.workLinks.length ? input.workLinks : Prisma.DbNull,
        barberCount: input.barberCount,
        currentBookingSystem: input.currentBookingSystem,
        hasOwnDomain: input.hasOwnDomain,
        notes: input.notes,
        authorisationConsentAt: now,
        marketingOptInAt: input.marketingOptIn ? now : null,
        entryPoint: input.entryPoint,
        events: {
          create: [
            { action: PREVIEW_REQUEST_ACTIONS.CREATED, toStatus: 'REQUESTED' },
            ...(overDailyCap ? [{ action: PREVIEW_REQUEST_ACTIONS.OVER_DAILY_CAP }] : []),
          ],
        },
      },
    });

    const ack = buildPreviewRequestAcknowledgementEmail({
      to: request.email,
      firstName: request.firstName,
      shopName: request.shopName,
      overDailyCap,
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
      overDailyCap,
    });
    const internalRow = await enqueueEmail(tx, {
      shopId: null,
      purpose: EmailOutboundPurpose.FREE_PREVIEW_REQUEST_INTERNAL,
      ...internal,
      dedupeKey: `free-preview:internal:${request.id}`,
    });

    return { request, outboxIds: [ackRow.id, internalRow.id], overDailyCap };
  });

  await Promise.all(outboxIds.map((id) => tryDeliverOutboxEmail(id)));
  return { id: request.id, overDailyCap };
}
