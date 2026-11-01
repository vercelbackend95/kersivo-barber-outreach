import { z } from 'zod';
import type { PreviewHubActor, PreviewHubAsset } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { serializeHubAsset, type HubAssetPublic } from './hubAssets';
import { HUB_MESSAGE_ATTACH_DENIED, HUB_MESSAGE_REQUIRED, HUB_MESSAGE_TOO_LONG } from './hubCopy';

export { escapeHubText, hubMessageExcerpt, splitHubMessageParts } from './hubMessageText';
export {
  HUB_MESSAGE_MAX_ATTACHMENTS,
  HUB_MESSAGE_MAX_CHARS,
  HUB_MESSAGES_POLL_MS,
  hubMessageDayKey,
  hubMessageTimeLabel,
  type HubMessagePublic,
} from './hubMessages.shared';
import { HUB_MESSAGE_MAX_ATTACHMENTS, HUB_MESSAGE_MAX_CHARS, type HubMessagePublic } from './hubMessages.shared';

export const HUB_MESSAGES_NOTIFY_WINDOW_MS = 15 * 60 * 1000;

export const hubMessagePostSchema = z.object({
  body: z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(
      z
        .string()
        .min(1, HUB_MESSAGE_REQUIRED)
        .max(HUB_MESSAGE_MAX_CHARS, HUB_MESSAGE_TOO_LONG),
    ),
  attachmentIds: z.array(z.string().min(1).max(64)).max(HUB_MESSAGE_MAX_ATTACHMENTS).optional(),
});

export type HubMessageRow = {
  id: string;
  author: PreviewHubActor;
  body: string;
  attachmentIds: string[];
  createdAt: Date;
  readByOwnerAt: Date | null;
  readByOpsAt: Date | null;
};

export function serializeHubMessage(
  row: HubMessageRow,
  attachments: HubAssetPublic[],
): HubMessagePublic {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    readByOwnerAt: row.readByOwnerAt?.toISOString() ?? null,
    readByOpsAt: row.readByOpsAt?.toISOString() ?? null,
    attachments,
  };
}

export async function loadHubMessageAttachments(
  previewRequestId: string,
  attachmentIds: string[],
): Promise<HubAssetPublic[]> {
  if (attachmentIds.length === 0) return [];
  const rows = await prisma.previewHubAsset.findMany({
    where: {
      id: { in: attachmentIds },
      previewRequestId,
      kind: 'MESSAGE_ATTACHMENT',
      deletedAt: null,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return attachmentIds
    .map((id) => byId.get(id))
    .filter((row): row is PreviewHubAsset => Boolean(row))
    .map(serializeHubAsset);
}

export async function loadLatestHubMessage(previewRequestId: string): Promise<HubMessagePublic | null> {
  const row = await prisma.previewHubMessage.findFirst({
    where: { previewRequestId },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return null;
  const attachments = await loadHubMessageAttachments(previewRequestId, row.attachmentIds);
  return serializeHubMessage(row, attachments);
}

export async function loadHubMessages(previewRequestId: string): Promise<HubMessagePublic[]> {
  const rows = await prisma.previewHubMessage.findMany({
    where: { previewRequestId },
    orderBy: { createdAt: 'asc' },
  });
  const ids = [...new Set(rows.flatMap((row) => row.attachmentIds))];
  const attachments = await loadHubMessageAttachments(previewRequestId, ids);
  const byId = new Map(attachments.map((asset) => [asset.id, asset]));
  return rows.map((row) =>
    serializeHubMessage(
      row,
      row.attachmentIds.map((id) => byId.get(id)).filter((asset): asset is HubAssetPublic => Boolean(asset)),
    ),
  );
}

export async function assertMessageAttachments(input: {
  previewRequestId: string;
  attachmentIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.attachmentIds.length === 0) return { ok: true };
  if (new Set(input.attachmentIds).size !== input.attachmentIds.length) {
    return { ok: false, error: HUB_MESSAGE_ATTACH_DENIED };
  }
  const rows = await prisma.previewHubAsset.findMany({
    where: {
      id: { in: input.attachmentIds },
      previewRequestId: input.previewRequestId,
      kind: 'MESSAGE_ATTACHMENT',
      deletedAt: null,
    },
    select: { id: true },
  });
  if (rows.length !== input.attachmentIds.length) {
    return { ok: false, error: HUB_MESSAGE_ATTACH_DENIED };
  }
  return { ok: true };
}

export async function createHubMessage(input: {
  previewRequestId: string;
  author: PreviewHubActor;
  authorEmail?: string | null;
  body: string;
  attachmentIds: string[];
}): Promise<HubMessagePublic> {
  const now = new Date();
  const row = await prisma.previewHubMessage.create({
    data: {
      previewRequestId: input.previewRequestId,
      author: input.author,
      authorEmail: input.author === 'KERSIVO' ? (input.authorEmail ?? null) : null,
      body: input.body,
      attachmentIds: input.attachmentIds,
      readByOwnerAt: input.author === 'OWNER' ? now : null,
      readByOpsAt: input.author === 'KERSIVO' ? now : null,
    },
  });
  const attachments = await loadHubMessageAttachments(input.previewRequestId, input.attachmentIds);
  return serializeHubMessage(row, attachments);
}

export async function countUnreadKersivoMessages(previewRequestId: string): Promise<number> {
  return prisma.previewHubMessage.count({
    where: { previewRequestId, author: 'KERSIVO', readByOwnerAt: null },
  });
}

export async function countUnreadOwnerMessages(previewRequestId: string): Promise<number> {
  return prisma.previewHubMessage.count({
    where: { previewRequestId, author: 'OWNER', readByOpsAt: null },
  });
}

export async function markKersivoMessagesReadByOwner(input: {
  previewRequestId: string;
  now?: Date;
}): Promise<number> {
  const result = await prisma.previewHubMessage.updateMany({
    where: { previewRequestId: input.previewRequestId, author: 'KERSIVO', readByOwnerAt: null },
    data: { readByOwnerAt: input.now ?? new Date() },
  });
  return result.count;
}

export async function markOwnerMessagesReadByOps(input: {
  previewRequestId: string;
  now?: Date;
}): Promise<number> {
  const result = await prisma.previewHubMessage.updateMany({
    where: { previewRequestId: input.previewRequestId, author: 'OWNER', readByOpsAt: null },
    data: { readByOpsAt: input.now ?? new Date() },
  });
  return result.count;
}

export async function deleteHubMessageRows(
  db: { previewHubMessage: { deleteMany: typeof prisma.previewHubMessage.deleteMany } },
  previewRequestId: string,
): Promise<number> {
  const result = await db.previewHubMessage.deleteMany({ where: { previewRequestId } });
  return result.count;
}

export async function clearHubMessageBodies(
  db: { previewHubMessage: { updateMany: typeof prisma.previewHubMessage.updateMany } },
  previewRequestId: string,
): Promise<number> {
  const result = await db.previewHubMessage.updateMany({
    where: { previewRequestId },
    data: { body: '', authorEmail: null },
  });
  return result.count;
}
