import { EmailOutboundPurpose } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { enqueueEmailOnce, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { getPreviewNotifyEmail, isAnyHubEnabled } from './config';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { buildHubMessageFromKersivoEmail, buildHubMessagesAddedInternalEmail } from './emails';
import { HUB_MESSAGES_NOTIFY_WINDOW_MS } from './hubMessages';

/** Immediate transactional email — sent even if the owner opted out of marketing follow-ups. */
export async function notifyOwnerOfKersivoMessage(input: {
  requestId: string;
  to: string;
  firstName: string | null;
  shopName: string;
  publicToken: string;
  body: string;
  messageId: string;
}): Promise<'sent' | 'skipped'> {
  if (!isAnyHubEnabled()) return 'skipped';
  const email = buildHubMessageFromKersivoEmail({
    to: input.to,
    firstName: input.firstName,
    shopName: input.shopName,
    publicToken: input.publicToken,
    body: input.body,
  });
  const { row, created } = await enqueueEmailOnce({
    shopId: null,
    purpose: EmailOutboundPurpose.FREE_PREVIEW_HUB_MESSAGE_OWNER,
    to: email.to,
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    dedupeKey: `free-preview:hub-message-owner:${input.requestId}:${input.messageId}`,
  });
  if (created) await tryDeliverOutboxEmail(row.id);
  return created ? 'sent' : 'skipped';
}

export function shouldSendHubMessagesDigest(input: {
  opsMessagesNotifiedAt: Date | null;
  now: Date;
}): boolean {
  if (!input.opsMessagesNotifiedAt) return true;
  return input.now.getTime() - input.opsMessagesNotifiedAt.getTime() >= HUB_MESSAGES_NOTIFY_WINDOW_MS;
}

export async function maybeNotifyOpsOfHubMessages(input: {
  requestId: string;
  shopName: string;
  now?: Date;
}): Promise<'sent' | 'deferred' | 'skipped'> {
  if (!isAnyHubEnabled()) return 'skipped';
  const now = input.now ?? new Date();
  const request = await prisma.previewRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, shopName: true, opsMessagesNotifiedAt: true, anonymisedAt: true },
  });
  if (!request || request.anonymisedAt) return 'skipped';
  if (!shouldSendHubMessagesDigest({ opsMessagesNotifiedAt: request.opsMessagesNotifiedAt, now })) {
    return 'deferred';
  }
  return sendHubMessagesDigest({
    requestId: request.id,
    shopName: request.shopName,
    since: request.opsMessagesNotifiedAt,
    now,
  });
}

export async function sendHubMessagesDigest(input: {
  requestId: string;
  shopName: string;
  since: Date | null;
  now: Date;
}): Promise<'sent' | 'skipped'> {
  const count = await prisma.previewHubMessage.count({
    where: {
      previewRequestId: input.requestId,
      author: 'OWNER',
      ...(input.since ? { createdAt: { gt: input.since } } : {}),
    },
  });
  if (count === 0) return 'skipped';

  const email = buildHubMessagesAddedInternalEmail({
    id: input.requestId,
    shopName: input.shopName,
    count,
  });
  const slot = Math.floor(input.now.getTime() / HUB_MESSAGES_NOTIFY_WINDOW_MS);
  const { row, created } = await enqueueEmailOnce({
    shopId: null,
    purpose: EmailOutboundPurpose.FREE_PREVIEW_HUB_MESSAGES_INTERNAL,
    to: getPreviewNotifyEmail(),
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    dedupeKey: `free-preview:hub-messages:${input.requestId}:${slot}`,
  });
  await prisma.previewRequest.update({
    where: { id: input.requestId },
    data: {
      opsMessagesNotifiedAt: input.now,
      events: {
        create: {
          action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_MESSAGES_NOTIFIED,
          meta: { count, created },
        },
      },
    },
  });
  if (created) await tryDeliverOutboxEmail(row.id);
  return 'sent';
}

/** Hourly lifecycle pickup for owner messages that landed inside the 15-minute debounce. */
export async function sendPendingHubMessageDigests(now: Date = new Date()): Promise<number> {
  if (!isAnyHubEnabled()) return 0;
  const cutoff = new Date(now.getTime() - HUB_MESSAGES_NOTIFY_WINDOW_MS);
  const due = await prisma.previewRequest.findMany({
    where: {
      anonymisedAt: null,
      opsMessagesNotifiedAt: { lte: cutoff },
      hubMessages: { some: { author: 'OWNER', createdAt: { gt: cutoff } } },
    },
    select: { id: true, shopName: true, opsMessagesNotifiedAt: true },
    take: 50,
  });
  let sent = 0;
  for (const row of due) {
    const result = await sendHubMessagesDigest({
      requestId: row.id,
      shopName: row.shopName,
      since: row.opsMessagesNotifiedAt,
      now,
    });
    if (result === 'sent') sent += 1;
  }
  return sent;
}
