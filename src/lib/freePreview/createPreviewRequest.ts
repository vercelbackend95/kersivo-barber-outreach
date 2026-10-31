import { EmailOutboundPurpose, Prisma } from '@prisma/client';
import { getLondonDayBounds } from '@/lib/admin/barberRosterPresentation';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { hashPreviewToken, mintPreviewToken } from '@/lib/preview/shopPreviewSession';
import { PREVIEW_DETAILS_TOKEN_TTL_MS, PREVIEW_DUPLICATE_WINDOW_MS, getFreePreviewDailyCap } from './config';
import { buildPreviewRequestAcknowledgementEmail, buildPreviewRequestInternalEmail } from './emails';
import { FREE_PREVIEW_AUTHORISATION_STATEMENT_VERSION, type FreePreviewRequestInput } from './intake';

export const PREVIEW_REQUEST_ACTIONS = {
  CREATED: 'CREATED',
  OVER_DAILY_CAP: 'OVER_DAILY_CAP',
  DETAILS_UPDATED: 'DETAILS_UPDATED',
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
  HUB_VIEWED: 'hub_viewed',
  HUB_ASSET_UPLOADED: 'hub_asset_uploaded',
  HUB_ASSET_UPDATED: 'hub_asset_updated',
  HUB_ASSET_DELETED: 'hub_asset_deleted',
  HUB_DETAILS_SAVED: 'hub_details_saved',
  HUB_MESSAGE_SENT: 'hub_message_sent',
  HUB_MESSAGES_READ: 'hub_messages_read',
  OPS_HUB_OPENED: 'ops_hub_opened',
  OPS_HUB_FILES_NOTIFIED: 'ops_hub_files_notified',
  OPS_HUB_MESSAGE_SENT: 'ops_hub_message_sent',
  OPS_HUB_MESSAGES_READ: 'ops_hub_messages_read',
  OPS_HUB_MESSAGES_NOTIFIED: 'ops_hub_messages_notified',
} as const;

/**
 * Stores a public preview request and queues E1 (owner) + E2 (internal) in the same transaction,
 * then attempts immediate delivery. The outbox cron retries anything that fails.
 * Requests over the daily cap are still saved; they carry an OVER_DAILY_CAP event and a longer-wait message.
 * A retry of a recent request (its response may never have arrived) updates nothing but the Step 2 token.
 * `leadToken` authorises Step 2 only: it is not the private preview link, and only its hash is stored.
 */
export async function createPreviewRequest(
  input: FreePreviewRequestInput,
  now: Date = new Date(),
): Promise<{ id: string; overDailyCap: boolean; leadToken: string }> {
  const publicToken = mintPreviewToken();
  const leadToken = mintPreviewToken();
  const detailsToken = {
    detailsTokenHash: hashPreviewToken(leadToken),
    detailsTokenExpiresAt: new Date(now.getTime() + PREVIEW_DETAILS_TOKEN_TTL_MS),
  };
  const { requestId, outboxIds, overDailyCap } = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.previewRequest.findFirst({
      where: {
        email: input.email,
        shopName: { equals: input.shopName, mode: 'insensitive' },
        createdAt: { gte: new Date(now.getTime() - PREVIEW_DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        events: { where: { action: PREVIEW_REQUEST_ACTIONS.OVER_DAILY_CAP }, select: { id: true }, take: 1 },
      },
    });
    if (duplicate) {
      await tx.previewRequest.update({ where: { id: duplicate.id }, data: detailsToken });
      return { requestId: duplicate.id, outboxIds: [], overDailyCap: duplicate.events.length > 0 };
    }

    const requestsToday = await tx.previewRequest.count({
      where: { createdAt: { gte: new Date(getLondonDayBounds(now).startMs) } },
    });
    const overDailyCap = requestsToday >= getFreePreviewDailyCap();

    const request = await tx.previewRequest.create({
      data: {
        publicToken,
        publicTokenHash: hashPreviewToken(publicToken),
        ...detailsToken,
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
        authorisationStatementVersion: FREE_PREVIEW_AUTHORISATION_STATEMENT_VERSION,
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
      publicToken: request.publicToken,
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

    return { requestId: request.id, outboxIds: [ackRow.id, internalRow.id], overDailyCap };
  });

  await Promise.all(outboxIds.map((id) => tryDeliverOutboxEmail(id)));
  return { id: requestId, overDailyCap, leadToken };
}
