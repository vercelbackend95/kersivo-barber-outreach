import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { HEX_COLOUR_RE, MAX_SWATCHES, normaliseHexColour } from '@/lib/adminHub/colour';
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
  brandPaletteExtracted: z.array(paletteItem).max(MAX_SWATCHES).nullable().optional(),
  send: z.boolean().optional(),
});

export type BrandColoursInput = z.infer<typeof brandColoursSchema>;

export type BrandColoursSaved = {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  brandBackgroundTone: 'DARK' | 'LIGHT' | null;
  brandColoursSource: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandPaletteExtracted: Array<{ hex: string; share: number }> | null;
  brandColoursSentAt: string | null;
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
  for (const item of value.slice(0, MAX_SWATCHES)) {
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
  brandColoursSentAt: Date | null;
}): BrandColoursSaved {
  return {
    brandPrimaryColour: row.brandPrimaryColour,
    brandSecondaryColour: row.brandSecondaryColour,
    brandBackgroundTone: asTone(row.brandBackgroundTone),
    brandColoursSource: asSource(row.brandColoursSource),
    brandPaletteExtracted: parseBrandPalette(row.brandPaletteExtracted),
    brandColoursSentAt: row.brandColoursSentAt ? row.brandColoursSentAt.toISOString() : null,
  };
}

export async function saveBrandColours(input: {
  requestId: string;
  patch: BrandColoursInput;
}): Promise<BrandColoursSaved> {
  const data: Prisma.PreviewRequestUpdateInput = {};
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
  const send = Boolean(input.patch.send);
  if (send) data.brandColoursSentAt = new Date();

  const fields = Object.keys(data);
  const row = await prisma.previewRequest.update({
    where: { id: input.requestId },
    data: {
      ...data,
      events: send
        ? {
            create: {
              action: PREVIEW_REQUEST_ACTIONS.BRAND_COLOURS_SENT,
              meta: {
                source: input.patch.brandColoursSource ?? null,
                tone: input.patch.brandBackgroundTone ?? null,
                fields,
              },
            },
          }
        : undefined,
    },
    select: {
      brandPrimaryColour: true,
      brandSecondaryColour: true,
      brandBackgroundTone: true,
      brandColoursSource: true,
      brandPaletteExtracted: true,
      brandColoursSentAt: true,
    },
  });
  return toBrandColoursSaved(row);
}
