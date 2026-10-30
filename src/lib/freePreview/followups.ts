import { EmailOutboundStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export function followupDedupeKey(id: string): string {
  return `free-preview:followup:${id}`;
}

export function expiryReminderDedupeKey(id: string): string {
  return `free-preview:expiry-reminder:${id}`;
}

/**
 * Stops an E5/E6 that is queued for retry. Called when the owner converts or declines and when the preview
 * expires, so a failed send retried by the outbox cron cannot arrive after that (spec §9).
 */
export async function suppressPendingPreviewFollowups(
  id: string,
  db: Pick<typeof prisma, 'emailOutbound'> = prisma,
): Promise<void> {
  await db.emailOutbound.updateMany({
    where: {
      dedupeKey: { in: [followupDedupeKey(id), expiryReminderDedupeKey(id)] },
      status: { in: [EmailOutboundStatus.QUEUED, EmailOutboundStatus.FAILED] },
    },
    data: { status: EmailOutboundStatus.SUPPRESSED, payload: Prisma.DbNull, nextAttemptAt: null, error: null },
  });
}
