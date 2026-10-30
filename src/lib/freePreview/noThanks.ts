import { Prisma, type PreviewRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { suppressPendingPreviewFollowups } from './followups';
import { resolvePreviewRequestByToken } from './previewAccess';

/** A preview was sent, so the owner can say no thanks. EXPIRED is included: E6 can be opened after expiry. */
const DECLINABLE_STATUSES: readonly PreviewRequestStatus[] = ['READY', 'CHANGES_REQUESTED', 'EXPIRED'];

export type NoThanksState = 'can_decline' | 'already_declined' | 'converted' | 'not_found';

/** What the no-thanks link shows. Unsent or rejected requests look exactly like an unknown token. */
export function noThanksStateFor(status: PreviewRequestStatus | null): NoThanksState {
  if (!status) return 'not_found';
  if (status === 'DECLINED') return 'already_declined';
  if (status === 'CONVERTED') return 'converted';
  return DECLINABLE_STATUSES.includes(status) ? 'can_decline' : 'not_found';
}

export async function resolveNoThanksState(token: string): Promise<NoThanksState> {
  const request = await resolvePreviewRequestByToken(token);
  return noThanksStateFor(request?.status ?? null);
}

/**
 * Sets declined + email opt-out and stops queued follow-ups (spec §9). Idempotent, and never touches a
 * paying customer. Returns the state before the change; 'can_decline' means this call declined it.
 */
export async function declinePreviewByToken(token: string, now: Date = new Date()): Promise<NoThanksState> {
  const found = await resolvePreviewRequestByToken(token);
  if (!found) return 'not_found';

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${found.id} FOR UPDATE`);
    const request = await tx.previewRequest.findUnique({ where: { id: found.id }, select: { status: true } });
    const state = noThanksStateFor(request?.status ?? null);
    if (state !== 'can_decline' || !request) return state;

    await tx.previewRequest.update({
      where: { id: found.id },
      data: {
        status: 'DECLINED',
        declinedAt: now,
        emailOptOut: true,
        emailOptOutAt: now,
        events: {
          create: {
            action: PREVIEW_REQUEST_ACTIONS.DECLINED,
            fromStatus: request.status,
            toStatus: 'DECLINED',
          },
        },
      },
    });
    await suppressPendingPreviewFollowups(found.id, tx);
    return state;
  });
}
