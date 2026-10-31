import { EmailOutboundPurpose, Prisma, type PreviewRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { hashPreviewToken, mintPreviewToken } from '@/lib/preview/shopPreviewSession';
import {
  beginShopPurgeGate,
  deletePrivateBlobPathsBestEffort,
  listPrivateBlobPathsForShopPurge,
  listPublicBlobUrlsForShopPurge,
  purgeShopData,
  runPostCommitPublicBlobCleanup,
} from '@/lib/setup/purgeShopData';
import {
  PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY,
  PREVIEW_EXPIRY_REMINDER_DAYS_BEFORE,
  PREVIEW_FOLLOWUP_DAYS_AFTER_READY,
  isFreePreviewFlowEnabled,
} from './config';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import {
  type FreePreviewEmail,
  buildPreviewExpiryReminderEmail,
  buildPreviewFollowupEmail,
  previewNoThanksUrl,
  previewPageUrl,
} from './emails';
import { expiryReminderDedupeKey, followupDedupeKey, suppressPendingPreviewFollowups } from './followups';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Per run, per step. The hourly cron works through anything larger on its next runs. */
const LIFECYCLE_BATCH_SIZE = 50;

/** Statuses a preview can expire from. */
const EXPIRABLE_STATUSES: PreviewRequestStatus[] = ['READY', 'CHANGES_REQUESTED'];

/** Statuses whose data the retention job removes. CONVERTED never; open requests are ops' to close. */
const RETENTION_STATUSES: PreviewRequestStatus[] = ['EXPIRED', 'DECLINED', 'REJECTED'];

type FollowupRow = {
  status: PreviewRequestStatus;
  emailOptOut: boolean;
  previewReadyAt: Date | null;
  expiresAt: Date | null;
  followupSentAt: Date | null;
  expiryReminderSentAt: Date | null;
};

/**
 * Follow-ups go only while the preview is READY: CHANGES_REQUESTED means the owner has answered and is
 * waiting for us, and every other status is excluded by spec §9.
 */
function canReceiveFollowups(row: FollowupRow, now: Date): boolean {
  return row.status === 'READY' && !row.emailOptOut && Boolean(row.expiresAt && row.expiresAt.getTime() > now.getTime());
}

function expiryReminderWindowOpen(row: FollowupRow, now: Date): boolean {
  if (!row.expiresAt) return false;
  return row.expiresAt.getTime() - PREVIEW_EXPIRY_REMINDER_DAYS_BEFORE * DAY_MS <= now.getTime();
}

/** E5. Skipped once E6 is due, so a late cron never sends both at once. */
export function isFollowupDue(row: FollowupRow, now: Date): boolean {
  if (!canReceiveFollowups(row, now) || row.followupSentAt || !row.previewReadyAt) return false;
  if (expiryReminderWindowOpen(row, now)) return false;
  return row.previewReadyAt.getTime() + PREVIEW_FOLLOWUP_DAYS_AFTER_READY * DAY_MS <= now.getTime();
}

/** E6. */
export function isExpiryReminderDue(row: FollowupRow, now: Date): boolean {
  return canReceiveFollowups(row, now) && !row.expiryReminderSentAt && expiryReminderWindowOpen(row, now);
}

/** Sets EXPIRED at expires_at. Declined and converted requests keep their status. */
export async function expireDuePreviews(now: Date): Promise<number> {
  const due = await prisma.previewRequest.findMany({
    where: { status: { in: EXPIRABLE_STATUSES }, expiresAt: { lte: now } },
    select: { id: true, status: true },
    take: LIFECYCLE_BATCH_SIZE,
  });
  let expired = 0;
  for (const row of due) {
    const done = await prisma.$transaction(async (tx) => {
      const updated = await tx.previewRequest.updateMany({
        where: { id: row.id, status: { in: EXPIRABLE_STATUSES }, expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      });
      if (updated.count === 0) return false;
      await tx.previewRequestEvent.create({
        data: {
          previewRequestId: row.id,
          action: PREVIEW_REQUEST_ACTIONS.EXPIRED,
          fromStatus: row.status,
          toStatus: 'EXPIRED',
        },
      });
      await suppressPendingPreviewFollowups(row.id, tx);
      return true;
    });
    if (done) expired += 1;
  }
  return expired;
}

/**
 * Claims the "sent" timestamp and queues the email in one transaction. The conditional update re-checks
 * the rules against the current row and the dedupe key is a second guard, so overlapping runs send once.
 */
async function claimAndQueue(input: {
  id: string;
  kind: 'followup' | 'expiry_reminder';
  email: FreePreviewEmail;
  now: Date;
}): Promise<string | null> {
  const { id, kind, now } = input;
  const isFollowup = kind === 'followup';
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.previewRequest.updateMany({
      where: {
        id,
        status: 'READY',
        emailOptOut: false,
        expiresAt: { gt: now },
        ...(isFollowup ? { followupSentAt: null } : { expiryReminderSentAt: null }),
      },
      data: isFollowup ? { followupSentAt: now } : { expiryReminderSentAt: now },
    });
    if (claimed.count === 0) return null;
    await tx.previewRequestEvent.create({
      data: {
        previewRequestId: id,
        action: isFollowup ? PREVIEW_REQUEST_ACTIONS.FOLLOWUP_SENT : PREVIEW_REQUEST_ACTIONS.EXPIRY_REMINDER_SENT,
      },
    });
    const row = await enqueueEmail(tx, {
      shopId: null,
      purpose: isFollowup ? EmailOutboundPurpose.FREE_PREVIEW_FOLLOWUP : EmailOutboundPurpose.FREE_PREVIEW_EXPIRY_REMINDER,
      ...input.email,
      dedupeKey: isFollowup ? followupDedupeKey(id) : expiryReminderDedupeKey(id),
    });
    return row.id;
  });
}

export async function sendDuePreviewFollowups(now: Date): Promise<{ followups: number; expiryReminders: number }> {
  const candidates = await prisma.previewRequest.findMany({
    where: {
      status: 'READY',
      emailOptOut: false,
      expiresAt: { gt: now },
      AND: [
        { OR: [{ followupSentAt: null }, { expiryReminderSentAt: null }] },
        {
          OR: [
            { previewReadyAt: { lte: new Date(now.getTime() - PREVIEW_FOLLOWUP_DAYS_AFTER_READY * DAY_MS) } },
            { expiresAt: { lte: new Date(now.getTime() + PREVIEW_EXPIRY_REMINDER_DAYS_BEFORE * DAY_MS) } },
          ],
        },
      ],
    },
    orderBy: { previewReadyAt: 'asc' },
    take: LIFECYCLE_BATCH_SIZE,
    select: {
      id: true,
      status: true,
      email: true,
      firstName: true,
      shopName: true,
      publicToken: true,
      emailOptOut: true,
      previewReadyAt: true,
      expiresAt: true,
      followupSentAt: true,
      expiryReminderSentAt: true,
    },
  });

  const outboxIds: string[] = [];
  let followups = 0;
  let expiryReminders = 0;
  for (const row of candidates) {
    const emailInput = {
      to: row.email,
      firstName: row.firstName,
      shopName: row.shopName,
      previewUrl: previewPageUrl(row.publicToken),
      noThanksUrl: previewNoThanksUrl(row.publicToken),
    };
    if (isExpiryReminderDue(row, now)) {
      const email = buildPreviewExpiryReminderEmail({ ...emailInput, expiresAt: row.expiresAt! });
      const outboxId = await claimAndQueue({ id: row.id, kind: 'expiry_reminder', email, now });
      if (outboxId) {
        outboxIds.push(outboxId);
        expiryReminders += 1;
      }
    } else if (isFollowupDue(row, now)) {
      const email = buildPreviewFollowupEmail(emailInput);
      const outboxId = await claimAndQueue({ id: row.id, kind: 'followup', email, now });
      if (outboxId) {
        outboxIds.push(outboxId);
        followups += 1;
      }
    }
  }

  await Promise.all(outboxIds.map((id) => tryDeliverOutboxEmail(id)));
  return { followups, expiryReminders };
}

class PreviewRetentionSkipped extends Error {}

/**
 * Deletes the draft shop and the request's personal data, keeping the row as an anonymised record
 * (status, dates, non-identifying selects) for the ops metrics. A draft with an owner or any subscription
 * beyond an abandoned checkout is never touched: that shop belongs to a customer.
 */
async function anonymisePreviewRequest(id: string, now: Date): Promise<boolean> {
  const row = await prisma.previewRequest.findUnique({
    where: { id },
    select: { draftShopId: true, draftShop: { select: { sitePreviewUrl: true } } },
  });
  if (!row) return false;
  const shopId = row.draftShopId;

  const assertShopDisposable = async (
    db: Pick<typeof prisma, 'shopSettings' | 'saasSubscription'>,
    draftId: string,
  ) => {
    const [shop, liveSubscriptions] = await Promise.all([
      db.shopSettings.findUnique({ where: { id: draftId }, select: { ownerUserId: true, shopPaidAt: true } }),
      db.saasSubscription.count({ where: { shopId: draftId, status: { not: 'PENDING' } } }),
    ]);
    if (shop?.ownerUserId || shop?.shopPaidAt || liveSubscriptions > 0) throw new PreviewRetentionSkipped();
  };

  let privateBlobPaths: string[] = [];
  let publicBlobUrls: string[] = [];
  let gateOpenedHere = false;
  try {
    if (shopId) {
      await assertShopDisposable(prisma, shopId);
      gateOpenedHere = !(await beginShopPurgeGate(shopId, now)).alreadyStarted;
      privateBlobPaths = await listPrivateBlobPathsForShopPurge(shopId);
      publicBlobUrls = await listPublicBlobUrlsForShopPurge(shopId);
    }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${id} FOR UPDATE`);
      const current = await tx.previewRequest.findUnique({
        where: { id },
        select: { status: true, anonymisedAt: true },
      });
      if (!current || current.anonymisedAt || !RETENTION_STATUSES.includes(current.status)) {
        throw new PreviewRetentionSkipped();
      }
      if (shopId) {
        await assertShopDisposable(tx, shopId);
        // Abandoned checkouts hold the owner's name and email. Terms acceptance evidence stays (see /privacy).
        await tx.saasSubscription.deleteMany({ where: { shopId, status: 'PENDING' } });
        await purgeShopData(tx, shopId);
      }
      await tx.emailOutbound.deleteMany({ where: { dedupeKey: { startsWith: 'free-preview:', contains: id } } });
      await tx.previewRequestEvent.deleteMany({ where: { previewRequestId: id } });
      const publicToken = mintPreviewToken();
      await tx.previewRequest.update({
        where: { id },
        data: {
          anonymisedAt: now,
          // New random token: the old private link can never resolve again.
          publicToken,
          publicTokenHash: hashPreviewToken(publicToken),
          detailsTokenHash: null,
          detailsTokenExpiresAt: null,
          firstName: null,
          email: `deleted-${id}@anonymised.invalid`,
          shopName: 'Deleted',
          townCity: 'Deleted',
          bookingPageUrl: null,
          instagramUrl: null,
          googleListingUrl: null,
          websiteUrl: null,
          workLinks: Prisma.DbNull,
          notes: null,
          changesRequestedText: null,
          internalNotes: null,
          brandPrimaryColour: null,
          brandSecondaryColour: null,
          styleNotes: null,
          aboutText: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          draftShopId: null,
          events: { create: { action: PREVIEW_REQUEST_ACTIONS.ANONYMISED } },
        },
      });
    });
  } catch (error) {
    if (shopId && gateOpenedHere) {
      await prisma.shopSettings
        .update({ where: { id: shopId }, data: { purgeStartedAt: null } })
        .catch((releaseError: unknown) => console.error('[free-preview] failed to release purge gate', { id, releaseError }));
    }
    if (error instanceof PreviewRetentionSkipped) {
      console.warn('[free-preview] retention skipped: request or draft shop no longer eligible', { id });
      return false;
    }
    throw error;
  }

  if (row.draftShop?.sitePreviewUrl) {
    // Hosted outside this app, so this job cannot delete it: ops must take the site down.
    console.warn('[free-preview] retention: remove the externally hosted preview site', {
      id,
      sitePreviewUrl: row.draftShop.sitePreviewUrl,
    });
  }

  if (shopId) {
    try {
      await deletePrivateBlobPathsBestEffort(privateBlobPaths);
      await runPostCommitPublicBlobCleanup(shopId, publicBlobUrls);
    } catch (error) {
      console.error('[free-preview] post-commit blob cleanup failed', {
        id,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
  return true;
}

/**
 * Retention days after expiry, or after rejection when no preview was ever sent. Declined requests count
 * from their original expiry. Never CONVERTED. One failure does not stop the rest.
 */
export async function purgeExpiredPreviewData(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY * DAY_MS);
  const due = await prisma.previewRequest.findMany({
    where: {
      status: { in: RETENTION_STATUSES },
      anonymisedAt: null,
      OR: [{ expiresAt: { lte: cutoff } }, { expiresAt: null, rejectedAt: { lte: cutoff } }],
    },
    select: { id: true },
    take: LIFECYCLE_BATCH_SIZE,
  });
  let anonymised = 0;
  for (const { id } of due) {
    try {
      if (await anonymisePreviewRequest(id, now)) anonymised += 1;
    } catch (error) {
      console.error('[free-preview] retention failed', { id, error: error instanceof Error ? error.message : 'unknown' });
    }
  }
  return anonymised;
}

export type PreviewLifecycleResult = {
  expired: number;
  followups: number;
  expiryReminders: number;
  anonymised: number;
};

/**
 * Hourly job. Expiry runs first so nothing is sent for a preview that has just expired. Follow-ups need the
 * flow on, because they link to the preview page (a 404 while it is off). Expiry and retention always run:
 * the deletion promise in the legal text does not depend on the flag.
 */
export async function runFreePreviewLifecycle(now: Date = new Date()): Promise<PreviewLifecycleResult> {
  const expired = await expireDuePreviews(now);
  const { followups, expiryReminders } = isFreePreviewFlowEnabled()
    ? await sendDuePreviewFollowups(now)
    : { followups: 0, expiryReminders: 0 };
  const anonymised = await purgeExpiredPreviewData(now);
  return { expired, followups, expiryReminders, anonymised };
}
