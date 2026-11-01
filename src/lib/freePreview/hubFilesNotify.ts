import { EmailOutboundPurpose } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { enqueueEmailOnce, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { getPreviewNotifyEmail, isAnyHubEnabled } from './config';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { buildHubFilesAddedInternalEmail } from './emails';
import { HUB_FILES_NOTIFY_WINDOW_MS } from './hubAssets';

export type HubFileKindCount = { kind: string; count: number };

export function countsByKind(rows: Array<{ kind: string }>): HubFileKindCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.kind, (map.get(row.kind) ?? 0) + 1);
  }
  return [...map.entries()].map(([kind, count]) => ({ kind, count }));
}

export function shouldSendHubFilesDigest(input: {
  opsFilesNotifiedAt: Date | null;
  now: Date;
}): boolean {
  if (!input.opsFilesNotifiedAt) return true;
  return input.now.getTime() - input.opsFilesNotifiedAt.getTime() >= HUB_FILES_NOTIFY_WINDOW_MS;
}

/**
 * Send an ops digest if the last one for this request is older than 15 minutes.
 * Otherwise leave it for the existing hourly lifecycle cron.
 */
export async function maybeNotifyOpsOfHubFiles(input: {
  requestId: string;
  shopName: string;
  now?: Date;
}): Promise<'sent' | 'deferred' | 'skipped'> {
  if (!isAnyHubEnabled()) return 'skipped';
  const now = input.now ?? new Date();
  const request = await prisma.previewRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, shopName: true, opsFilesNotifiedAt: true, anonymisedAt: true },
  });
  if (!request || request.anonymisedAt) return 'skipped';
  if (!shouldSendHubFilesDigest({ opsFilesNotifiedAt: request.opsFilesNotifiedAt, now })) {
    return 'deferred';
  }
  return sendHubFilesDigest({
    requestId: request.id,
    shopName: request.shopName,
    since: request.opsFilesNotifiedAt,
    now,
  });
}

export async function sendHubFilesDigest(input: {
  requestId: string;
  shopName: string;
  since: Date | null;
  now: Date;
}): Promise<'sent' | 'skipped'> {
  const assets = await prisma.previewHubAsset.findMany({
    where: {
      previewRequestId: input.requestId,
      deletedAt: null,
      ...(input.since ? { createdAt: { gt: input.since } } : {}),
    },
    select: { kind: true },
  });
  if (assets.length === 0) return 'skipped';

  const counts = countsByKind(assets);
  const email = buildHubFilesAddedInternalEmail({
    id: input.requestId,
    shopName: input.shopName,
    counts,
  });
  const slot = Math.floor(input.now.getTime() / HUB_FILES_NOTIFY_WINDOW_MS);
  const { row, created } = await enqueueEmailOnce({
    shopId: null,
    purpose: EmailOutboundPurpose.FREE_PREVIEW_HUB_FILES_INTERNAL,
    to: getPreviewNotifyEmail(),
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    dedupeKey: `free-preview:hub-files:${input.requestId}:${slot}`,
  });
  await prisma.previewRequest.update({
    where: { id: input.requestId },
    data: {
      opsFilesNotifiedAt: input.now,
      events: {
        create: {
          action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_FILES_NOTIFIED,
          meta: { counts, created },
        },
      },
    },
  });
  if (created) await tryDeliverOutboxEmail(row.id);
  return 'sent';
}

/** Hourly lifecycle pickup for uploads that landed inside the 15-minute debounce. */
export async function sendPendingHubFileDigests(now: Date = new Date()): Promise<number> {
  if (!isAnyHubEnabled()) return 0;
  const cutoff = new Date(now.getTime() - HUB_FILES_NOTIFY_WINDOW_MS);
  const due = await prisma.previewRequest.findMany({
    where: {
      anonymisedAt: null,
      opsFilesNotifiedAt: { lte: cutoff },
      hubAssets: { some: { deletedAt: null, createdAt: { gt: cutoff } } },
    },
    select: { id: true, shopName: true, opsFilesNotifiedAt: true },
    take: 50,
  });
  let sent = 0;
  for (const row of due) {
    const result = await sendHubFilesDigest({
      requestId: row.id,
      shopName: row.shopName,
      since: row.opsFilesNotifiedAt,
      now,
    });
    if (result === 'sent') sent += 1;
  }
  return sent;
}
