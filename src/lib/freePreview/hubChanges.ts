import { EmailOutboundPurpose, Prisma, type PreviewChangeStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { buildPreviewChangesRequestedInternalEmail } from './emails';
import {
  HUB_CHANGES_BODY_REQUIRED,
  HUB_CHANGES_BODY_TOO_LONG,
  HUB_CHANGES_DENIED,
  HUB_CHANGES_NO_DRAFTS,
  HUB_ROUND_USED,
} from './hubCopy';

export {
  HUB_CHANGE_BODY_MAX,
  HUB_CHANGE_PAGES,
  HUB_OPEN_CHANGE_STATUSES,
  changePageLabel,
  type HubChangePublic,
} from './hubChanges.shared';
import {
  HUB_CHANGE_BODY_MAX,
  HUB_CHANGE_PAGES,
  HUB_OPEN_CHANGE_STATUSES,
  changePageLabel,
  type HubChangePublic,
} from './hubChanges.shared';

export const hubChangeDraftSchema = z.object({
  page: z.enum(HUB_CHANGE_PAGES),
  body: z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(z.string().min(1, HUB_CHANGES_BODY_REQUIRED).max(HUB_CHANGE_BODY_MAX, HUB_CHANGES_BODY_TOO_LONG)),
  attachmentId: z.string().trim().min(1).max(64).optional().nullable(),
});

export const hubChangeStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DONE', 'NOT_POSSIBLE']),
  opsNote: z.string().trim().max(2000).optional().nullable(),
});

export function serializeHubChange(row: {
  id: string;
  page: string;
  body: string;
  attachmentId: string | null;
  status: PreviewChangeStatus;
  opsNote: string | null;
  round: number | null;
  createdAt: Date;
  sentAt: Date | null;
  resolvedAt: Date | null;
}): HubChangePublic {
  return {
    id: row.id,
    page: (HUB_CHANGE_PAGES as readonly string[]).includes(row.page)
      ? (row.page as HubChangePublic['page'])
      : 'OTHER',
    pageLabel: changePageLabel(row.page),
    body: row.body,
    attachmentId: row.attachmentId,
    status: row.status,
    opsNote: row.opsNote,
    round: row.round,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export function renderChangesPlainText(
  items: Array<{ page: string; body: string }>,
): string {
  return items
    .map((item) => `${changePageLabel(item.page)}: ${item.body}`)
    .join('\n\n');
}

export async function loadHubChanges(previewRequestId: string): Promise<HubChangePublic[]> {
  const rows = await prisma.previewChangeRequest.findMany({
    where: { previewRequestId },
    orderBy: [{ createdAt: 'asc' }],
  });
  return rows.map(serializeHubChange);
}

export async function countOpenHubChanges(previewRequestId: string): Promise<number> {
  return prisma.previewChangeRequest.count({
    where: { previewRequestId, status: { in: [...HUB_OPEN_CHANGE_STATUSES] } },
  });
}

export async function assertChangeAttachment(input: {
  previewRequestId: string;
  attachmentId: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.attachmentId) return { ok: true };
  const asset = await prisma.previewHubAsset.findFirst({
    where: {
      id: input.attachmentId,
      previewRequestId: input.previewRequestId,
      kind: 'CHANGE_ATTACHMENT',
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!asset) return { ok: false, error: 'That file is not a change attachment for this preview.' };
  return { ok: true };
}

export async function createHubChangeDraft(input: {
  previewRequestId: string;
  page: (typeof HUB_CHANGE_PAGES)[number];
  body: string;
  attachmentId?: string | null;
}): Promise<HubChangePublic> {
  const row = await prisma.previewChangeRequest.create({
    data: {
      previewRequestId: input.previewRequestId,
      page: input.page,
      body: input.body,
      attachmentId: input.attachmentId ?? null,
      status: 'DRAFT',
    },
  });
  return serializeHubChange(row);
}

export async function updateHubChangeDraft(input: {
  previewRequestId: string;
  changeId: string;
  page: (typeof HUB_CHANGE_PAGES)[number];
  body: string;
  attachmentId?: string | null;
}): Promise<HubChangePublic | null> {
  const existing = await prisma.previewChangeRequest.findFirst({
    where: { id: input.changeId, previewRequestId: input.previewRequestId, status: 'DRAFT' },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await prisma.previewChangeRequest.update({
    where: { id: existing.id },
    data: {
      page: input.page,
      body: input.body,
      attachmentId: input.attachmentId ?? null,
    },
  });
  return serializeHubChange(row);
}

export async function deleteHubChangeDraft(input: {
  previewRequestId: string;
  changeId: string;
}): Promise<boolean> {
  const result = await prisma.previewChangeRequest.deleteMany({
    where: { id: input.changeId, previewRequestId: input.previewRequestId, status: 'DRAFT' },
  });
  return result.count > 0;
}

export type SendHubChangesResult =
  | { ok: true; round: number; items: HubChangePublic[] }
  | { ok: false; code: 'NO_DRAFTS' | 'ROUND_USED' | 'NOT_AVAILABLE'; error: string };

export async function sendHubChanges(input: {
  previewRequestId: string;
  now?: Date;
}): Promise<SendHubChangesResult> {
  const now = input.now ?? new Date();
  const outboxId = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${input.previewRequestId} FOR UPDATE`);
    const request = await tx.previewRequest.findUnique({
      where: { id: input.previewRequestId },
      select: {
        id: true,
        status: true,
        email: true,
        shopName: true,
        townCity: true,
        includedChangeRounds: true,
        changeRoundsUsed: true,
      },
    });
    if (!request || (request.status !== 'READY' && request.status !== 'CHANGES_REQUESTED')) {
      return { kind: 'fail' as const, code: 'NOT_AVAILABLE' as const, error: HUB_CHANGES_DENIED };
    }
    if (request.changeRoundsUsed >= request.includedChangeRounds) {
      return { kind: 'fail' as const, code: 'ROUND_USED' as const, error: HUB_ROUND_USED };
    }

    const drafts = await tx.previewChangeRequest.findMany({
      where: { previewRequestId: request.id, status: 'DRAFT' },
      orderBy: { createdAt: 'asc' },
    });
    if (drafts.length === 0) {
      return { kind: 'fail' as const, code: 'NO_DRAFTS' as const, error: HUB_CHANGES_NO_DRAFTS };
    }

    const round = request.changeRoundsUsed + 1;
    await tx.previewChangeRequest.updateMany({
      where: { previewRequestId: request.id, status: 'DRAFT' },
      data: { status: 'SENT', round, sentAt: now },
    });
    const text = renderChangesPlainText(drafts);
    const event = await tx.previewRequestEvent.create({
      data: {
        previewRequestId: request.id,
        action: PREVIEW_REQUEST_ACTIONS.HUB_CHANGES_SENT,
        fromStatus: request.status,
        toStatus: 'CHANGES_REQUESTED',
        meta: { round, count: drafts.length },
      },
      select: { id: true },
    });
    await tx.previewRequest.update({
      where: { id: request.id },
      data: {
        status: 'CHANGES_REQUESTED',
        changeRoundsUsed: { increment: 1 },
        changesRequestedText: text,
        changesRequestedAt: now,
      },
    });
    const email = buildPreviewChangesRequestedInternalEmail({
      ...request,
      changesText: text,
      items: drafts.map((row) => ({ page: row.page, body: row.body })),
    });
    const row = await enqueueEmail(tx, {
      shopId: null,
      purpose: EmailOutboundPurpose.FREE_PREVIEW_CHANGES_REQUESTED_INTERNAL,
      ...email,
      dedupeKey: `free-preview:changes:${request.id}:${event.id}`,
    });
    return { kind: 'ok' as const, round, outboxId: row.id, drafts };
  });

  if (outboxId.kind === 'fail') return { ok: false, code: outboxId.code, error: outboxId.error };
  await tryDeliverOutboxEmail(outboxId.outboxId);
  const items = await loadHubChanges(input.previewRequestId);
  return { ok: true, round: outboxId.round, items };
}

export async function setHubChangeStatus(input: {
  previewRequestId: string;
  changeId: string;
  status: 'IN_PROGRESS' | 'DONE' | 'NOT_POSSIBLE';
  opsNote?: string | null;
  now?: Date;
}): Promise<HubChangePublic | null> {
  const existing = await prisma.previewChangeRequest.findFirst({
    where: {
      id: input.changeId,
      previewRequestId: input.previewRequestId,
      status: { in: ['SENT', 'IN_PROGRESS', 'DONE', 'NOT_POSSIBLE'] },
    },
  });
  if (!existing) return null;
  if (input.status === 'NOT_POSSIBLE' && !input.opsNote?.trim()) return null;
  const now = input.now ?? new Date();
  const resolved = input.status === 'DONE' || input.status === 'NOT_POSSIBLE';
  const row = await prisma.previewChangeRequest.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      opsNote: input.opsNote?.trim() || existing.opsNote,
      resolvedAt: resolved ? now : null,
    },
  });
  return serializeHubChange(row);
}

export async function grantHubChangeRound(input: {
  previewRequestId: string;
}): Promise<{ includedChangeRounds: number; changeRoundsUsed: number } | null> {
  const request = await prisma.previewRequest.findUnique({
    where: { id: input.previewRequestId },
    select: { id: true, includedChangeRounds: true, changeRoundsUsed: true, anonymisedAt: true },
  });
  if (!request || request.anonymisedAt) return null;
  const updated = await prisma.previewRequest.update({
    where: { id: request.id },
    data: { includedChangeRounds: { increment: 1 } },
    select: { includedChangeRounds: true, changeRoundsUsed: true },
  });
  return updated;
}

export async function loadResolvedChangesSinceLastSend(previewRequestId: string): Promise<
  Array<{ page: string; body: string; status: 'DONE' | 'NOT_POSSIBLE'; opsNote: string | null }>
> {
  const lastReady = await prisma.previewRequestEvent.findFirst({
    where: { previewRequestId, action: PREVIEW_REQUEST_ACTIONS.MARKED_READY },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const rows = await prisma.previewChangeRequest.findMany({
    where: {
      previewRequestId,
      status: { in: ['DONE', 'NOT_POSSIBLE'] },
      resolvedAt: lastReady ? { gt: lastReady.createdAt } : { not: null },
    },
    orderBy: { resolvedAt: 'asc' },
    select: { page: true, body: true, status: true, opsNote: true },
  });
  return rows.map((row) => ({
    page: row.page,
    body: row.body,
    status: row.status as 'DONE' | 'NOT_POSSIBLE',
    opsNote: row.opsNote,
  }));
}

export async function clearHubChangeBodies(
  db: { previewChangeRequest: { updateMany: typeof prisma.previewChangeRequest.updateMany } },
  previewRequestId: string,
): Promise<number> {
  const result = await db.previewChangeRequest.updateMany({
    where: { previewRequestId },
    data: { body: '', opsNote: null, attachmentId: null, anchor: Prisma.JsonNull },
  });
  return result.count;
}

export async function deleteHubChangeRows(
  db: { previewChangeRequest: { deleteMany: typeof prisma.previewChangeRequest.deleteMany } },
  previewRequestId: string,
): Promise<number> {
  const result = await db.previewChangeRequest.deleteMany({ where: { previewRequestId } });
  return result.count;
}
