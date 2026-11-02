import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { HUB_BRAND_LOCKED } from '@/lib/freePreview/hubCopy';

export const BRAND_LOCKED = 'BRAND_LOCKED';

export type BrandLockState = {
  locked: boolean;
  submittedAt: string | null;
};

export type BrandSubmittedSnapshot = {
  logoAssetId: string | null;
  logoStoragePath: string | null;
  logoOriginalFileName: string | null;
  logoContentType: string | null;
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  brandBackgroundTone: string | null;
  brandColoursSource: string | null;
  brandPaletteExtracted: Array<{ hex: string; share: number }> | null;
  submittedByUserId: string | null;
};

export class BrandLockedError extends Error {
  readonly code = BRAND_LOCKED;
  readonly httpStatus = 409;
  readonly submittedAt: string;

  constructor(submittedAt: Date | string) {
    super(HUB_BRAND_LOCKED);
    this.name = 'BrandLockedError';
    this.submittedAt = submittedAt instanceof Date ? submittedAt.toISOString() : submittedAt;
  }

  toJson() {
    return {
      ok: false as const,
      error: this.message,
      code: this.code,
      submittedAt: this.submittedAt,
    };
  }
}

export function isBrandLockedError(error: unknown): error is BrandLockedError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: unknown }).code === BRAND_LOCKED &&
      'submittedAt' in error &&
      typeof (error as { submittedAt: unknown }).submittedAt === 'string',
  );
}

export function brandLockState(sentAt: Date | string | null | undefined): BrandLockState {
  if (!sentAt) return { locked: false, submittedAt: null };
  const submittedAt = sentAt instanceof Date ? sentAt.toISOString() : sentAt;
  return { locked: true, submittedAt };
}

type LockClient = {
  $queryRaw: (query: Prisma.Sql) => Promise<unknown>;
  previewRequest: {
    findUnique: (args: {
      where: { id: string };
      select: { brandColoursSentAt: true };
    }) => Promise<{ brandColoursSentAt: Date | null } | null>;
  };
};

export async function assertBrandUnlockedTx(tx: LockClient, requestId: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${requestId} FOR UPDATE`);
  const row = await tx.previewRequest.findUnique({
    where: { id: requestId },
    select: { brandColoursSentAt: true },
  });
  if (row?.brandColoursSentAt) throw new BrandLockedError(row.brandColoursSentAt);
}

export async function assertBrandUnlocked(requestId: string): Promise<void> {
  const row = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { brandColoursSentAt: true },
  });
  if (row?.brandColoursSentAt) throw new BrandLockedError(row.brandColoursSentAt);
}

type SnapshotClient = {
  previewHubAsset: {
    findFirst: (args: {
      where: { previewRequestId: string; kind: 'LOGO'; deletedAt: null };
      orderBy: { createdAt: 'desc' };
      select: { id: true; storagePath: true; originalFileName: true; contentType: true };
    }) => Promise<{
      id: string;
      storagePath: string;
      originalFileName: string;
      contentType: string;
    } | null>;
  };
};

export async function buildBrandSubmittedSnapshot(
  tx: SnapshotClient,
  input: {
    requestId: string;
    brandPrimaryColour: string | null;
    brandSecondaryColour: string | null;
    brandBackgroundTone: string | null;
    brandColoursSource: string | null;
    brandPaletteExtracted: Array<{ hex: string; share: number }> | null;
    submittedByUserId: string | null;
  },
): Promise<BrandSubmittedSnapshot> {
  const logo = await tx.previewHubAsset.findFirst({
    where: { previewRequestId: input.requestId, kind: 'LOGO', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, storagePath: true, originalFileName: true, contentType: true },
  });
  return {
    logoAssetId: logo?.id ?? null,
    logoStoragePath: logo?.storagePath ?? null,
    logoOriginalFileName: logo?.originalFileName ?? null,
    logoContentType: logo?.contentType ?? null,
    brandPrimaryColour: input.brandPrimaryColour,
    brandSecondaryColour: input.brandSecondaryColour,
    brandBackgroundTone: input.brandBackgroundTone,
    brandColoursSource: input.brandColoursSource,
    brandPaletteExtracted: input.brandPaletteExtracted,
    submittedByUserId: input.submittedByUserId,
  };
}

export type UnlockBrandResult =
  | { ok: true; wasLocked: boolean; submittedAt: string | null }
  | { ok: false; code: 'NOT_FOUND' };

export async function unlockBrandColours(input: {
  requestId: string;
  actorEmail: string;
  now?: Date;
}): Promise<UnlockBrandResult> {
  return prisma.$transaction(async (tx): Promise<UnlockBrandResult> => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "PreviewRequest" WHERE id = ${input.requestId} FOR UPDATE`);
    const row = await tx.previewRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, brandColoursSentAt: true },
    });
    if (!row) return { ok: false, code: 'NOT_FOUND' };
    if (!row.brandColoursSentAt) {
      return { ok: true, wasLocked: false, submittedAt: null };
    }
    const previouslySubmittedAt = row.brandColoursSentAt.toISOString();
    await tx.previewRequest.update({
      where: { id: row.id },
      data: {
        brandColoursSentAt: null,
        events: {
          create: {
            action: PREVIEW_REQUEST_ACTIONS.BRAND_UNLOCKED,
            actorEmail: input.actorEmail,
            meta: {
              previouslySubmittedAt,
              unlockedAt: (input.now ?? new Date()).toISOString(),
            },
          },
        },
      },
    });
    return { ok: true, wasLocked: true, submittedAt: previouslySubmittedAt };
  });
}
