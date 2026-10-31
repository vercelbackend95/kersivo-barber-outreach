import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { HEX_COLOUR_RE, normaliseHexColour } from './extractLogoColours';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';

export const HUB_STYLE_NOTES_MAX = 500;
export const HUB_ABOUT_TEXT_MAX = 600;

const optionalHex = z
  .union([z.string(), z.null()])
  .optional()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null || value.trim() === '') return;
    if (!HEX_COLOUR_RE.test(value.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Colour must be #RRGGBB.' });
    }
  })
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === '') return null;
    return normaliseHexColour(value);
  });

export const hubDetailsSchema = z.object({
  brandPrimaryColour: optionalHex,
  brandSecondaryColour: optionalHex,
  styleNotes: z
    .union([z.string().max(HUB_STYLE_NOTES_MAX), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === null ? null : value.trim() || null)),
  aboutText: z
    .union([z.string().max(HUB_ABOUT_TEXT_MAX), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === null ? null : value.trim() || null)),
});

export type HubDetailsInput = z.infer<typeof hubDetailsSchema>;

export const hubAssetPatchSchema = z.object({
  caption: z
    .union([z.string().max(140), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === null ? null : value.trim() || null)),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  barberId: z
    .union([z.string().min(1).max(64), z.null()])
    .optional(),
});

export async function saveHubDetails(input: {
  requestId: string;
  patch: HubDetailsInput;
}): Promise<{
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  styleNotes: string | null;
  aboutText: string | null;
}> {
  const data: Record<string, string | null> = {};
  if (input.patch.brandPrimaryColour !== undefined) data.brandPrimaryColour = input.patch.brandPrimaryColour;
  if (input.patch.brandSecondaryColour !== undefined) data.brandSecondaryColour = input.patch.brandSecondaryColour;
  if (input.patch.styleNotes !== undefined) data.styleNotes = input.patch.styleNotes;
  if (input.patch.aboutText !== undefined) data.aboutText = input.patch.aboutText;

  const row = await prisma.previewRequest.update({
    where: { id: input.requestId },
    data: {
      ...data,
      events: { create: { action: PREVIEW_REQUEST_ACTIONS.HUB_DETAILS_SAVED, meta: { fields: Object.keys(data) } } },
    },
    select: {
      brandPrimaryColour: true,
      brandSecondaryColour: true,
      styleNotes: true,
      aboutText: true,
    },
  });
  return row;
}
