import { z } from 'zod';
import { writeShopPublicProfile } from '@/lib/shopData/profile';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { HEX_COLOUR_RE, MAX_PALETTE, normaliseHexColour } from '@/lib/adminHub/colour';
import {
  assertBrandUnlockedTx,
  BrandLockedError,
  brandLockState,
  buildBrandSubmittedSnapshot,
} from '@/lib/adminHub/brandLock';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';

export const BRAND_COLOURS_SENT = 'BRAND_COLOURS_SENT';

const optionalHex = z
  .union([z.string(), z.null()])
  .optional()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null || value.trim() === '') return;
    if (!HEX_COLOUR_RE.test(value.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Colour must be #RGB or #RRGGBB.' });
    }
  })
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === '') return null;
    return normaliseHexColour(value);
  });

const paletteItem = z.object({
  hex: z
    .string()
    .refine((value) => HEX_COLOUR_RE.test(value.trim()), 'Colour must be #RGB or #RRGGBB.')
    .transform((value) => normaliseHexColour(value)!),
  share: z.number().min(0).max(1),
});

export const brandColoursSchema = z.object({
  brandPrimaryColour: optionalHex,
  brandSecondaryColour: optionalHex,
  brandBackgroundTone: z.enum(['DARK', 'LIGHT']).nullable().optional(),
  brandColoursSource: z.enum(['LOGO', 'MANUAL', 'KERSIVO_CHOOSES']).nullable().optional(),
  brandPaletteExtracted: z.array(paletteItem).max(MAX_PALETTE).nullable().optional(),
  brandPaletteLogoAssetId: z.string().trim().min(1).max(64).nullable().optional(),
  send: z.boolean().optional(),
});

export type BrandColoursInput = z.infer<typeof brandColoursSchema>;

export type BrandColoursSaved = {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  brandBackgroundTone: 'DARK' | 'LIGHT' | null;
  brandColoursSource: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandPaletteExtracted: Array<{ hex: string; share: number }> | null;
  brandPaletteLogoAssetId: string | null;
  brandColoursSentAt: string | null;
  brandLocked: boolean;
};

function asTone(value: string | null): BrandColoursSaved['brandBackgroundTone'] {
  return value === 'DARK' || value === 'LIGHT' ? value : null;
}

function asSource(value: string | null): BrandColoursSaved['brandColoursSource'] {
  return value === 'LOGO' || value === 'MANUAL' || value === 'KERSIVO_CHOOSES' ? value : null;
}

export function parseBrandPalette(value: unknown): Array<{ hex: string; share: number }> | null {
  if (!Array.isArray(value)) return null;
  const rows: Array<{ hex: string; share: number }> = [];
  for (const item of value.slice(0, MAX_PALETTE)) {
    if (!item || typeof item !== 'object') continue;
    const hex = normaliseHexColour((item as { hex?: unknown }).hex as string);
    const share = Number((item as { share?: unknown }).share);
    if (!hex || !Number.isFinite(share)) continue;
    rows.push({ hex, share: Math.max(0, Math.min(1, share)) });
  }
  return rows.length ? rows : null;
}

export function toBrandColoursSaved(row: {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  brandBackgroundTone: string | null;
  brandColoursSource: string | null;
  brandPaletteExtracted: unknown;
  brandPaletteLogoAssetId?: string | null;
  brandColoursSentAt: Date | null;
}): BrandColoursSaved {
  const lock = brandLockState(row.brandColoursSentAt);
  return {
    brandPrimaryColour: row.brandPrimaryColour,
    brandSecondaryColour: row.brandSecondaryColour,
    brandBackgroundTone: asTone(row.brandBackgroundTone),
    brandColoursSource: asSource(row.brandColoursSource),
    brandPaletteExtracted: parseBrandPalette(row.brandPaletteExtracted),
    brandPaletteLogoAssetId: row.brandPaletteLogoAssetId ?? null,
    brandColoursSentAt: lock.submittedAt,
    brandLocked: lock.locked,
  };
}

const COLOUR_SELECT = {
  brandPrimaryColour: true,
  brandSecondaryColour: true,
  brandBackgroundTone: true,
  brandColoursSource: true,
  brandPaletteExtracted: true,
  brandPaletteLogoAssetId: true,
  brandColoursSentAt: true,
} as const;

export async function saveBrandColours(input: {
  requestId: string;
  patch: BrandColoursInput;
  submittedByUserId?: string | null;
  now?: Date;
}): Promise<BrandColoursSaved> {
  const send = Boolean(input.patch.send);
  const now = input.now ?? new Date();
  const submittedByUserId = input.submittedByUserId ?? null;

  return prisma.$transaction(async (tx) => {
    await assertBrandUnlockedTx(tx, input.requestId);

    const current = await tx.previewRequest.findUnique({
      where: { id: input.requestId },
      select: COLOUR_SELECT,
    });
    if (!current) {
      throw new Error('Preview request not found.');
    }

    const data: Prisma.PreviewRequestUpdateManyMutationInput = {};
    if (input.patch.brandPrimaryColour !== undefined) data.brandPrimaryColour = input.patch.brandPrimaryColour;
    if (input.patch.brandSecondaryColour !== undefined) data.brandSecondaryColour = input.patch.brandSecondaryColour;
    if (input.patch.brandBackgroundTone !== undefined) data.brandBackgroundTone = input.patch.brandBackgroundTone;
    if (input.patch.brandColoursSource !== undefined) data.brandColoursSource = input.patch.brandColoursSource;
    if (input.patch.brandPaletteExtracted !== undefined) {
      data.brandPaletteExtracted =
        input.patch.brandPaletteExtracted === null
          ? Prisma.JsonNull
          : (input.patch.brandPaletteExtracted as Prisma.InputJsonValue);
    }
    if (input.patch.brandPaletteLogoAssetId !== undefined) {
      data.brandPaletteLogoAssetId = input.patch.brandPaletteLogoAssetId;
    }

    const nextPrimary =
      input.patch.brandPrimaryColour !== undefined ? input.patch.brandPrimaryColour : current.brandPrimaryColour;
    const nextSecondary =
      input.patch.brandSecondaryColour !== undefined
        ? input.patch.brandSecondaryColour
        : current.brandSecondaryColour;
    const nextTone =
      input.patch.brandBackgroundTone !== undefined ? input.patch.brandBackgroundTone : current.brandBackgroundTone;
    const nextSource =
      input.patch.brandColoursSource !== undefined ? input.patch.brandColoursSource : current.brandColoursSource;
    const nextPalette =
      input.patch.brandPaletteExtracted !== undefined
        ? input.patch.brandPaletteExtracted
        : parseBrandPalette(current.brandPaletteExtracted);

    if (send) {
      const snapshot = await buildBrandSubmittedSnapshot(tx as never, {
        requestId: input.requestId,
        brandPrimaryColour: nextPrimary,
        brandSecondaryColour: nextSecondary,
        brandBackgroundTone: nextTone,
        brandColoursSource: nextSource,
        brandPaletteExtracted: parseBrandPalette(nextPalette),
        submittedByUserId,
      });
      const submitData: Prisma.PreviewRequestUpdateManyMutationInput = {
        ...data,
        brandColoursSentAt: now,
        brandSubmittedByUserId: submittedByUserId,
        brandSubmittedSnapshot: snapshot as Prisma.InputJsonValue,
      };
      // DB-level guard: a second submit (or a racing double-click) matches zero rows.
      const claimed = await tx.previewRequest.updateMany({
        where: { id: input.requestId, brandColoursSentAt: null },
        data: submitData,
      });
      if (claimed.count !== 1) {
        const existing = await tx.previewRequest.findUnique({
          where: { id: input.requestId },
          select: { brandColoursSentAt: true },
        });
        if (existing?.brandColoursSentAt) throw new BrandLockedError(existing.brandColoursSentAt);
        throw new Error('Preview request not found.');
      }
      await tx.previewRequestEvent.create({
        data: {
          previewRequestId: input.requestId,
          action: PREVIEW_REQUEST_ACTIONS.BRAND_COLOURS_SENT,
          meta: {
            source: nextSource,
            tone: nextTone,
            fields: [...Object.keys(data), 'brandColoursSentAt'],
            snapshot,
            submittedByUserId,
          },
        },
      });
      const row = await tx.previewRequest.findUniqueOrThrow({
        where: { id: input.requestId },
        select: COLOUR_SELECT,
      });
      await mirrorBrandColoursToProfile(tx, input.requestId, nextPrimary, nextSecondary);
      return toBrandColoursSaved(row);
    }

    const row = await tx.previewRequest.update({
      where: { id: input.requestId },
      data,
      select: COLOUR_SELECT,
    });
    await mirrorBrandColoursToProfile(tx, input.requestId, nextPrimary, nextSecondary);
    return toBrandColoursSaved(row);
  });
}

/** Canonical brand colours (site data contract) once the request has a draft shop. */
async function mirrorBrandColoursToProfile(
  tx: Prisma.TransactionClient,
  requestId: string,
  brandPrimaryColour: string | null,
  brandSecondaryColour: string | null,
): Promise<void> {
  const link = await tx.previewRequest.findUnique({
    where: { id: requestId },
    select: { draftShopId: true },
  });
  if (!link?.draftShopId) return;
  await writeShopPublicProfile(tx, link.draftShopId, { brandPrimaryColour, brandSecondaryColour });
}
